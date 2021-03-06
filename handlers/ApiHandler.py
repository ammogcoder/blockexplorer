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
import time

class BlockAfterHandler(BaseHandler):
	
	@tornado.gen.coroutine
	def get(self):
		response = yield self.api.getBlocksAfter(int(self.get_argument('height')))
		self.write(response.body)
		self.finish()
		
class LastBlockHandler(BaseHandler):
	def get(self):
		self.write(zlib.decompress(self.redis_client.zrange('blocks', 0, 2, 'desc')[0]))
		self.finish()
		
class TestAccountHandler(BaseHandler):
	def get(self):
		addr = self.get_argument('address')
		txs = self.redis_client.zrange('acc'+addr, 0, 20, 'desc')
		txs = [json.loads(tx) for tx in txs]
		txs = json.dumps({'data':txs})
		self.write(txs)
		self.finish()


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
		self.finish()

class SearchBlockByHashHandler(BaseHandler):
	
	def get(self):
		hash = self.get_argument('hash')
		self.write(self.redis_client.get(hash))
		self.finish()
		
class SearchTxByHashHandler(BaseHandler):
	def get(self):
		hash = self.get_argument('hash')
		self.write(self.redis_client.get(hash))
		self.finish()
		
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
		self.finish()
	
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
		self.finish()
		
class BlockChartHandlerCustom(BaseHandler):
	
	def get(self):
		number_of_blocks = int(self.get_argument('numBlock', 120)) + 1
		starting_height = int(self.get_argument('height', 0)) - 1
		time1 = time.clock()
		#blocks = self.redis_client.zrevrangebyscore('blocks', starting_height+number_of_blocks, starting_height)
		timestamps = self.redis_client.zrange('timestamps', end=starting_height+number_of_blocks, start=starting_height, withscores=True)
		time2 = time.clock()
		print "blocktimes got %d blocks [%s]" % (len(timestamps), time2-time1)
		times = collections.OrderedDict()
		foo = collections.OrderedDict()
		"""
		blocks = map(lambda b: json.loads(zlib.decompress(b)), blocks)
		for i in xrange(len(blocks) - 1):
			blocka = blocks[i]
			blockb = blocks[i + 1]
			timea = blocka['timestamp_unix']
			timeb = blockb['timestamp_unix']
			delta = timea - timeb
			times[blocka['height']]= delta
			foo[blocka['height']] = len(blocka['txes'])
		"""
		for i in xrange(len(timestamps) - 1):
			t1 = timestamps[i]
			t2 = timestamps[i + 1]
			timea = t1[1]
			timeb = t2[1]
			delta = timeb - timea
			times[t1[0]] = delta
			foo[t1[0]] = 0
		time3 = time.clock()
		print "time taken: %s" % (time3-time2)
		self.write(json.dumps({'blocktimes':times, 'tlen':foo}))
		self.finish()

class NxtBlockChartHandlerCustom(BaseHandler):
	
	def get(self):
		number_of_blocks = int(self.get_argument('numBlock', 120)) + 1
		starting_height = int(self.get_argument('height', 0)) - 1
		time1 = time.clock()
		timestamps = self.redis_client.zrange('nxtstamps', -number_of_blocks-1, -1, withscores=True)
		time2 = time.clock()
		print "blocktimes got %d blocks [%s]" % (len(timestamps), time2-time1)
		times = collections.OrderedDict()
		foo = collections.OrderedDict()
		for i in xrange(len(timestamps) - 1):
			t1 = timestamps[i]
			t2 = timestamps[i + 1]
			timea = t1[1]
			timeb = t2[1]
			delta = timeb - timea
			times[t1[0]] = delta
			foo[t1[0]] = 0
		time3 = time.clock()
		print "time taken: %s" % (time3-time2)
		self.write(json.dumps({'blocktimes':times, 'tlen':foo}))
		self.finish()

class HarvesterStatsHandler(BaseHandler):
	
	def get(self):
		sortby = self.get_argument('sortby', '')
		result = {'top50': []}
		
		if sortby in ('blocks', ''):
			harvesters = self.redis_client.zrange('harvesters', 0, 49, 'desc', 'WITHSCORES')
			for harvester in harvesters:
				fees = self.redis_client.zscore('fees_earned', harvester[0]) or "0"
				result['top50'].append({'address': harvester[0], 'blocks': int(harvester[1]), 'fees': int(fees)})
		
		elif sortby == 'fees':
			harvesters = self.redis_client.zrange('fees_earned', 0, 49, 'desc', 'WITHSCORES')
			for harvester in harvesters:
				blocks = self.redis_client.zscore('harvesters', harvester[0])
				result['top50'].append({'address': harvester[0], 'blocks': int(blocks), 'fees': int(harvester[1])})
		
		self.write(json.dumps(result))
		self.finish()
			
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
			url = "http://" + self.ip + ":7890/node/info"
			req = tornado.httpclient.HTTPRequest(url, connect_timeout=1.0, request_timeout=3.0)
			response = yield self.http_client.fetch(req)
			self.write(response.body)
		except:
			self.write(json.dumps({'error':'Could not communicate with remote NIS at %s' % self.ip}))
		
		self.finish()
		
class NodeListHandler(BaseHandler):
	def get(self):
		r = self.redis_client.get('nodes_last_time')
		d = json.loads(self.redis_client.get('active_nodes'))
		o = {'nodes':d, 'lastTime':r}
		self.write(json.dumps(o))
		self.finish()
		
