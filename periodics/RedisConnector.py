'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import redis
import tornado.gen
import ujson as json
import datetime
from api_connectors import async_httpapi
from handlers import SocketHandler
from toolbox import hash_converter


class RedisConnector():
    redis_client = redis.StrictRedis(host='localhost', port=6379, db=12)
    refresh_after = 25
    counter = 0
    counter2 = 0
    nemesis = datetime.datetime(2014,5,25)
        
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
                self.counter2 = 0
        response = yield api.getblocksafter(height)
        
        for block in json.loads(response.body)['data']:            
            if height != 1:
                if self.counter2 < self.refresh_after:
                    self.counter2 += 1
                else:    
                    self.counter += 1
            block['signer'] = hash_converter.convert_to_address(block['signer'])
            
            blockdatetime = datetime.timedelta(seconds=int(block['timestamp']))
            block['timestamp'] = str(self.nemesis + blockdatetime)
            
            self.redis_client.zadd('blocks', block['height'], tornado.escape.json_encode(block))
            self.redis_client.publish('block_channel', block)