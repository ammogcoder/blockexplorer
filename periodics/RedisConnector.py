'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import tornado.gen
import ujson as json
import time
import traceback
import zlib
import datetime
from periodics.BasePeriodic import BasePeriodic
from toolbox.hash_converter import convert_to_address as pk2address

class RedisConnector(BasePeriodic):
    
    def __init__(self):
        super(RedisConnector, self).__init__()
        self.refresh_after = int(self.parser.get("api", "runs_to_reindex"))
        self.runs = 0
        self.seen_blocks = 0
        self.nemEpoch = datetime.datetime(2015, 2, 1, 0, 0, 0, 0, None)
    
    def _get_height(self):
        if self.redis_client.zcard('blocks') == 0:
            return 1 
        else:
            return int(json.loads(zlib.decompress(self.redis_client.zrange('blocks', 0, 1, 'desc')[0]))['height'])
            
    def _calc_unix(self, nemStamp):
        r = self.nemEpoch + datetime.timedelta(seconds=nemStamp)
        return (r - datetime.datetime.utcfromtimestamp(0)).total_seconds()

    def _calc_timestamp(self, timestamp):
        r = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(timestamp))
        return r
    
    @tornado.gen.coroutine
    def run(self):
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
            #print response.body
            
            for blockData in json.loads(response.body)['data']:
                block_is_known = False
                block = blockData["block"] 
		print "block height:", block['height']
                block['hash'] = blockData['hash']
                block['signerAddress'] = pk2address(block['signer'])
                
                if self.seen_blocks >= block['height']:
                    block_is_known = True
                else:
                    self.seen_blocks = block['height']
                    
                block['timestamp_unix'] = self._calc_unix(block['timeStamp'])
                block['timestamp'] = self._calc_timestamp(block['timestamp_unix'])
                
                fees_total = 0
                
                txes = blockData["txes"]
                block['txes'] = []
                for txData in txes:
                    tx = txData['tx']
                    tx['hash'] = txData['hash']
                    tx['signerAddress'] = pk2address(tx['signer'])

                    timestamps_unix = self._calc_unix(tx['timeStamp'])
                    tx['timestamp'] = self._calc_timestamp(timestamps_unix)
                    tx['block'] = block['height']
                    
                    if 'otherTrans' in tx:
                        tx['otherTrans']['signerAddress'] = pk2address(tx['otherTrans']['signer'])
                    if 'signatures' in tx:
                        for sig in tx['signatures']:
                            sig['signerAddress'] = pk2address(sig['signer'])
                    # TODO : wrong
                    fees_total += tx['fee']
                    
                    #save tx in redis
                    self.redis_client.set(txData['hash'], tornado.escape.json_encode(tx))
                    if not block_is_known:
                        self.redis_client.zadd('tx', timestamps_unix, tornado.escape.json_encode(tx))
                        self.redis_client.publish('tx_channel', tornado.escape.json_encode(tx))
                    block['txes'].append(tx)
                
                #save blocks in redis
                self.redis_client.zadd('blocks', block['height'], zlib.compress(tornado.escape.json_encode(block), 9))
                self.redis_client.set(blockData['hash'], tornado.escape.json_encode(block))
                if not block_is_known:
                    self.redis_client.publish('block_channel', tornado.escape.json_encode(block))
                
                #stats
                if block_is_known: #only use for stats at 2nd index
                    self.redis_client.zincrby('harvesters', block['signerAddress'], 1.0)
                    self.redis_client.zincrby('fees_earned', block['signerAddress'], 0.0)
        except:
            traceback.print_exc()

