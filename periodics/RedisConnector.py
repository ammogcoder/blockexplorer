'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import redis
import tornado.gen
import ujson as json
import time
import traceback
import zlib
from api_connectors import async_httpapi
from ConfigParser import SafeConfigParser


class RedisConnector():
    parser = SafeConfigParser()
    parser.read("settings.INI")
    api = async_httpapi.AHttpApi()
    redis_client = redis.StrictRedis(host='localhost', port=6379, db=12)
    refresh_after = int(parser.get("api", "runs_to_reindex"))
    runs = 0
    seen_blocks = 0
    
    def _get_height(self):
        if self.redis_client.zcard('blocks') == 0:
            return 1 
        else:
            return int(json.loads(zlib.decompress(self.redis_client.zrange('blocks', 0, 1, 'desc')[0]))['height'])
            
    def _calc_timestamp(self, timestamp):
        return time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(timestamp/1000))
    
    @tornado.gen.coroutine
    def update_redischain(self):
        #reindex
        try:
            if self.runs >= self.refresh_after:
                self.redis_client.zremrangebyscore('blocks', self.seen_blocks - int(self.parser.get("api", "blocks_per_reindex")), self.seen_blocks)
                self.runs = 0
            else:
                self.runs += 1
        except:
            traceback.print_exc() 
        try:
            response = yield self.api.getblocksafter(self._get_height())
            
            for block in json.loads(response.body)['data']:
                block_is_known = False
                
                if self.seen_blocks >= block['height']:
                    block_is_known = True
                else:
                    self.seen_blocks = block['height']
                    
                block['timestamp_unix'] = block['timeStamp']
                block['timestamp'] = self._calc_timestamp(block['timeStamp'])
                
                fees_total = 0
                
                for tx in block['txes']:
                    timestamps_unix = tx['timeStamp']
                    tx['timestamp'] = self._calc_timestamp(tx['timeStamp'])
                    tx['block'] = block['height']
                    
                    fees_total += tx['fee']  
                    
                    #save tx in redis
                    self.redis_client.zadd('tx', timestamps_unix, tornado.escape.json_encode(tx))
                    self.redis_client.set(tx['hash'], tornado.escape.json_encode(tx))
                    if not block_is_known:
                        self.redis_client.publish('tx_channel', tornado.escape.json_encode(tx))
                
                #save blocks in redis
                self.redis_client.zadd('blocks', block['height'], zlib.compress(tornado.escape.json_encode(block), 9))
                self.redis_client.set(block['hash'], tornado.escape.json_encode(block))
                if not block_is_known:
                    self.redis_client.publish('block_channel', tornado.escape.json_encode(block))
                
                #stats
                if block_is_known: #only use for stats at 2nd index
                    self.redis_client.zincrby('harvesters', block['harvester'], 1.0)
                    self.redis_client.zincrby('fees_earned', block['harvester'], fees_total)                
        except:
            traceback.print_exc()