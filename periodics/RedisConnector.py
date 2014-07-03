'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import redis
import tornado.gen
import ujson as json
import datetime
import zlib
import base64
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
    nemesis = datetime.datetime(2014,6,25)
        
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
        
        for metablock in json.loads(response.body)['data']:            
            if self.counter < self.refresh_after and not self.reindexing:
                self.counter += 1
            else:
                self.counter2 += 1
                            
            block = metablock['block']
            block['hash'] = base64.binascii.hexlify(metablock['meta']['hash']['data'])    
            block['signer'] = hash_converter.convert_to_address(block['signer'])
            
            for tx in block['transactions']:
                tx['signer'] = hash_converter.convert_to_address(tx['signer'])
            
            blockdatetime = datetime.timedelta(seconds=int(block['timestamp']))
            block['timestamp'] = str(self.nemesis + blockdatetime)
            
            #save blocks in redis
            self.redis_client.zadd('blocks', block['height'], tornado.escape.json_encode(block))
            self.redis_client.set(block['hash'], tornado.escape.json_encode(block))
            
            #save tx in redis
            #TODO
            
            if not self.reindexing:
                self.redis_client.publish('block_channel', tornado.escape.json_encode(block))
            if self.counter2 == self.refresh_after:
                self.reindexing = False
                self.counter2 = 0