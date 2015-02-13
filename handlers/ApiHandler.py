'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import tornado.gen
import json
import tornadoredis
import re
import tornado.websocket
import collections
import zlib
from itertools import izip_longest
from handlers.BaseHandler import BaseHandler

class BlockAfterHandler(BaseHandler):
	
	@tornado.gen.coroutine
	def get(self):
		response = yield self.api.getBlocksAfter(int(self.get_argument('height')))
		self.write(response.body)
		self.finish()
		
class LastBlockHandler(BaseHandler):
	def get(self):
		self.write(zlib.decompress(self.redis_client.zrange('blocks', 0, 2, 'desc')[0]))
		
class TestAccountHandler(BaseHandler):
	def get(self):
		addr = self.get_argument('address')
		txs = self.redis_client.zrange('acc'+addr, 0, 20, 'desc')
		txs = [json.loads(tx) for tx in txs]
		txs = json.dumps({'data':txs})
		self.write(txs)


class SearchHandler(BaseHandler):
	@tornado.gen.coroutine
	def get(self):
		searchstring = self.get_argument('q')
		#decide if address or hash and act accordingly
		if re.match('T[A-Z0-9]+', searchstring):
			address = searchstring
			response = yield self.api.getAccount(address)
			data = json.loads(response.body)
			data['meta']['in'] = self.redis_client.zscore('nem_recv', address)
			data['meta']['out'] = self.redis_client.zscore('nem_sent', address)
			data['meta']['harvest'] = self.redis_client.zscore('fees_earned', address)
			self.write(json.dumps(data))

		else:
			self.write(self.redis_client.get(searchstring))

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
		address = self.get_argument('address')
		response = yield self.api.getAccount(address)
		data = json.loads(response.body)
		data['meta']['in'] = self.redis_client.zscore('nem_recv', address)
		data['meta']['out'] = self.redis_client.zscore('nem_sent', address)
		data['meta']['harvest'] = self.redis_client.zscore('fees_earned', address)
		self.write(json.dumps(data))
		self.finish()

class TransfersHandler(BaseHandler):
	
	@tornado.gen.coroutine
	def get(self):
		response = yield self.api.getAllTxForAccount(self.get_argument('address'))
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
				
		blocks = [json.loads(zlib.decompress(b)) for b in blocks]
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
		
class BlockChartHandlerCustom(BaseHandler):
	
	def get(self):
		number_of_blocks = int(self.get_argument('numBlock', 120)) + 1
		starting_height = int(self.get_argument('height', 0)) - 1
		blocks = self.redis_client.zrevrangebyscore('blocks', starting_height+number_of_blocks, starting_height)
		times = collections.OrderedDict()
		for i in xrange(len(blocks) - 1):
			blocka = json.loads(zlib.decompress(blocks[i]))
			blockb = json.loads(zlib.decompress(blocks[i + 1]))
			timea = blocka['timestamp_unix']
			timeb = blockb['timestamp_unix']
			delta = timea - timeb
			times[blocka['height']]= delta			
		self.write(json.dumps({'blocktimes':times}))

class BlockChartHandler(BaseHandler):
	
	def get(self):
		n = int(self.get_argument('lvl', 0))
		if n > 3:
			n = 0
		possibilites = {0:120, 1:240, 2:480, 3:1000}
		blocks = self.redis_client.zrange('blocks', 0, possibilites[n], 'desc')
		times = {}
		for i in xrange(len(blocks) - 1):
			blocka = json.loads(zlib.decompress(blocks[i]))
			blockb = json.loads(zlib.decompress(blocks[i + 1]))
			timea = blocka['timestamp_unix']
			timeb = blockb['timestamp_unix']
			delta = timea - timeb
			times[blocka['height']]= delta			
		self.write(json.dumps({'blocktimes':times}))

class HarvesterStatsHandler(BaseHandler):
	
	def get(self):
		sortby = self.get_argument('sortby', '')
		result = {'top50': []}
		
		if sortby in ('blocks', ''):
			harvesters = self.redis_client.zrange('harvesters', 0, 49, 'desc', 'WITHSCORES')
			for harvester in harvesters:
				fees = self.redis_client.zscore('fees_earned', harvester[0])
				result['top50'].append({'address': harvester[0], 'blocks': int(harvester[1]), 'fees': int(fees)})
		
		elif sortby == 'fees':
			harvesters = self.redis_client.zrange('fees_earned', 0, 49, 'desc', 'WITHSCORES')
			for harvester in harvesters:
				blocks = self.redis_client.zscore('harvesters', harvester[0])
				result['top50'].append({'address': harvester[0], 'blocks': int(blocks), 'fees': int(harvester[1])})
		
		self.write(json.dumps(result))
			
class CheckNis(BaseHandler):
	def __init__(self, *args, **kwargs):	
		super(CheckNis, self).__init__(*args, **kwargs)
		self.ip = None
		self.http_client = tornado.httpclient.AsyncHTTPClient()
		
	@tornado.gen.coroutine	
	def get(self):
		passed_ip = self.get_argument('ip', '')
		if passed_ip != '':
			self.ip = passed_ip
		else:
			self.ip = self.request.headers.get('X-Forwarded-For')
		try:
			response = yield self.http_client.fetch("http://" + self.ip + ":7890/node/info")
			self.write(response.body)
		except:
			self.write(json.dumps({'error':'Could not communicate with remote NIS at %s' % self.ip}))
		
		self.finish()
		
class NodeListHandler(BaseHandler):
	def get(self):
		self.write(self.redis_client.get('active_nodes'))
		
