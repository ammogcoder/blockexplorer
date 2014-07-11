'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import redis
import tornado.gen
import ujson as json
import datetime
import time
import zlib
import base64
import traceback
from api_connectors import async_httpapi
from handlers import SocketHandler
from toolbox import hash_converter
from ConfigParser import SafeConfigParser


class RedisConnector():
    parser = SafeConfigParser()
    parser.read("settings.INI")
    
    redis_client = redis.StrictRedis(host='localhost', port=6379, db=12)
    refresh_after = int(parser.get("api", "blocks_to_reindex"))
    counter = 0
    counter2 = 0
    reindexing = False
        
    @classmethod  
    @tornado.gen.coroutine
    def update_redischain(self):
        api = async_httpapi.AHttpApi()
        
        if self.redis_client.zcard('blocks') == 0:
            height = 1 
        else:
            height = int(self.redis_client.zrange('blocks', 0, 2, 'desc', 'withscores')[0][1])
            if self.counter >= self.refresh_after:
                self.redis_client.zremrangebyscore('blocks', height-self.refresh_after, height)
                height -= self.refresh_after
                self.counter = 0
                self.reindexing = True
        response = yield api.getblocksafter(height)
        
        for block in json.loads(response.body)['data']:
            if self.counter < self.refresh_after and not self.reindexing:
                self.counter += 1
            else:
                self.counter2 += 1
            
            block['timestamp'] = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(block['timestamp']/1000))
            
            for tx in block['txes']:
                timestamps_seconds = tx['timestamp']
                tx['timestamp'] = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(tx['timestamp']/1000))
                tx['block'] = block['height']
                
                #save tx in redis
                self.redis_client.zadd('tx', timestamps_seconds, tornado.escape.json_encode(tx))
                self.redis_client.set(tx['hash'], tornado.escape.json_encode(block))
                if not self.reindexing:
                    self.redis_client.publish('tx_channel', tornado.escape.json_encode(tx))
            
            #save blocks in redis
            self.redis_client.zadd('blocks', block['height'], tornado.escape.json_encode(block))
            self.redis_client.set(block['hash'], tornado.escape.json_encode(block))
            
            if not self.reindexing:
                self.redis_client.publish('block_channel', tornado.escape.json_encode(block))
            if self.counter2 == self.refresh_after:
                self.reindexing = False
                self.counter2 = 0