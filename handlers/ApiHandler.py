'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import tornado.gen
import json
import tornadoredis
import tornado.websocket
from itertools import izip_longest
from handlers.BaseHandler import BaseHandler

class BlockAfterHandler(BaseHandler):
	
	@tornado.gen.coroutine
	def get(self):
		response = yield self.api.getblocksafter(int(self.get_argument('height')))
		self.write(response.body)
		self.finish()
		
class LastBlockHandler(BaseHandler):
	
	def get(self):
		self.write(self.redis_client.zrange('blocks', 0, 2, 'desc')[0])
		
class SearchBlockByHashHandler(BaseHandler):
	
	def get(self):
		hash = self.get_argument('hash')
		self.write(self.redis_client.get(hash))
		
class SearchTxByHashHandler(BaseHandler):
	def get(self):
		hash = self.get_argument('hash')
		self.write(self.redis_client.get(hash))

class AccountHandler(BaseHandler):
	
	@tornado.gen.coroutine
	def get(self):
		response = yield self.api.getaccount(self.get_argument('address'))
		self.write(response.body)
		self.finish()

class TransfersHandler(BaseHandler):
	
	@tornado.gen.coroutine
	def get(self):
		response = yield self.api.getalltxforaccount(self.get_argument('address'))
		self.write(response.body)
		self.finish()
		

class FromToBlocksHandler(BaseHandler):
	
	def get(self):
		hfrom = int(self.get_argument('from', 0))
		hto = int(self.get_argument('to', 0))
		page = int(self.get_argument('page', 0))
		blocks_per_page = int(self.parser.get("api", "blocks_per_page"))
		
		if page != 0:
			blocks_per_page -= 2
			start = 0 
			if page > 1:
				start = blocks_per_page*(page-1)
			end = start + blocks_per_page + 1
			blocks = self.redis_client.zrange('blocks', start, end, 'desc')
		elif hfrom == 0 and hto == 0:
			blocks = self.redis_client.zrange('blocks', 0, blocks_per_page-1, 'desc')			
		else:
			blocks = self.redis_client.zrangebyscore('blocks', hfrom, hto)
			blocks.reverse()
				
		blocks = [json.loads(b) for b in blocks]
		blocks = json.dumps({"data":blocks})						
		self.write(blocks)
	
class FromToTxHandler(BaseHandler):
	
	def get(self):
		page = int(self.get_argument('page', 0))
		blocks_per_page = int(self.parser.get("api", "blocks_per_page"))
		
		if page != 0:
			blocks_per_page -= 2
			start = 0 
			if page > 1:
				start = blocks_per_page*(page-1)
			end = start + blocks_per_page + 1
			txs = self.redis_client.zrange('tx', start, end, 'desc')
		else:
			txs = self.redis_client.zrange('tx', 0, blocks_per_page-1, 'desc')
			
				
		txs = [json.loads(tx) for tx in txs]
		txs = json.dumps({'data':txs})						
		self.write(txs)
		
class BlockChartHandler(BaseHandler):
	
	def get(self):
		blocks = self.redis_client.zrange('blocks', 0, 120, 'desc')
		times = {}
		for i in xrange(len(blocks) - 1):
			blocka = json.loads(blocks[i])
			blockb = json.loads(blocks[i + 1])
			timea = blocka['timestamp_unix']
			timeb = blockb['timestamp_unix']
			delta = timea - timeb
			times[blocka['height']]= delta			
		self.write(json.dumps({'blocktimes':times}))

class HarvesterStatsHandler(BaseHandler):
	
	def get(self):
		sortby = self.get_argument('sortby', '')
		result = {'top10': []}
		
		if sortby in ('blocks', ''):
			harvesters = self.redis_client.zrange('harvesters', 0, 9, 'desc', 'WITHSCORES')
			for harvester in harvesters:
				fees = self.redis_client.zscore('fees_earned', harvester[0])
				result['top10'].append({'address': harvester[0], 'blocks': int(harvester[1]), 'fees': int(fees)})
		
		elif sortby == 'fees':
			harvesters = self.redis_client.zrange('fees_earned', 0, 9, 'desc', 'WITHSCORES')
			for harvester in harvesters:
				blocks = self.redis_client.zscore('harvesters', harvester[0])
				result['top10'].append({'address': harvester[0], 'blocks': int(blocks), 'fees': int(harvester[1])})
		
		self.write(json.dumps(result))
			
