'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import redis
import tornado.gen
import ujson as json
import time
import traceback
from api_connectors import async_httpapi
from ConfigParser import SafeConfigParser


class RedisConnector():
    parser = SafeConfigParser()
    parser.read("settings.INI")
    api = async_httpapi.AHttpApi()
    redis_client = redis.StrictRedis(host='localhost', port=6379, db=12)
    refresh_after = int(parser.get("api", "blocks_to_reindex"))
    
    def _get_height(self):
        if self.redis_client.zcard('blocks') == 0:
            return 1 
        else:
            return int(json.loads(self.redis_client.zrange('blocks', 0, 1, 'desc')[0])['height'])
            
    def _calc_timestamp(self, timestamp):
        return time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(timestamp/1000))
    
    @tornado.gen.coroutine
    def update_redischain(self):
        try:
            response = yield self.api.getblocksafter(self._get_height())
            
            for block in json.loads(response.body)['data']:
                
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
                    self.redis_client.publish('tx_channel', tornado.escape.json_encode(tx))
                
                #save blocks in redis
                self.redis_client.zadd('blocks', block['height'], tornado.escape.json_encode(block))
                self.redis_client.set(block['hash'], tornado.escape.json_encode(block))
                self.redis_client.publish('block_channel', tornado.escape.json_encode(block))
                
                #stats
                self.redis_client.zincrby('harvesters', block['harvester'], 1.0)
                self.redis_client.zincrby('fees_earned', block['harvester'], fees_total)                
        except:
            traceback.print_exc()