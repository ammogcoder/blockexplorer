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
		self.lastHeight = 1
		self.findLastHeight()
	
	def findLastHeight(self):
		while len(self.redis_client.zrangebyscore('blocks', self.lastHeight, self.lastHeight)) >= 1:
			self.lastHeight += 1
			if (self.lastHeight % 256) == 0:
				data = self.redis_client.zrangebyscore('blocks', self.lastHeight, self.lastHeight)
				if len(data) > 0: 
					print "got ",self.lastHeight,json.loads(zlib.decompress(data[0]))['height']

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

	def _addAccountTx(self, address, tx):
		self.redis_client.zadd('acc'+address, tx['timeStamp'], tornado.escape.json_encode(tx))

	def addAccountTx(self, pk, tx):
		address=pk2address(pk)
		self._addAccountTx(address, tx)

	def _processTransaction(self, srcTx, tx):
		self.addAccountTx(srcTx['signer'], tx)
		if 'remoteAccount' in srcTx:
			self.addAccountTx(tx['signer'], tx)
		if 'modifications' in srcTx:
			for mod in srcTx['modifications']:
				self.addAccountTx(mod['cosignatoryAccount'], tx)
		if 'recipient' in srcTx:
			self._addAccountTx(srcTx['recipient'], tx)

	def nemSub(self, address, amount):
		self.redis_client.zincrby('nem_sent', address, amount)

	def nemAdd(self, address, amount):
		self.redis_client.zincrby('nem_recv', address, amount)

	def processNemFlow(self, tx):
		txtype = tx['type']
		# transfer transaction
		if txtype == 257:
			self.nemSub(pk2address(tx['signer']), tx['fee']);
			self.nemSub(pk2address(tx['signer']), tx['amount']);
			self.nemAdd(tx['recipient'], tx['amount'])
		# importance transfer
		elif txtype == 2049:
			self.nemSub(pk2address(tx['signer']), tx['fee']);
		# aggregate
		elif txtype == 4097:
			self.nemSub(pk2address(tx['signer']), tx['fee']);
		# sig - won't happen
		elif txtype == 4098:
			pass
		# MT
		elif txtype == 4100:
			# charge multisig account
			self.nemSub(pk2address(tx['otherTrans']['signer']), tx['fee']);
			for sig in tx['signatures']:
				self.nemSub(pk2address(tx['otherTrans']['signer']), sig['fee']);

			self.processNemFlow(tx['otherTrans'])

	def processTransaction(self, tx):
		self.processNemFlow(tx)
		self._processTransaction(tx, tx)
		if 'otherTrans' in tx:
			self._processTransaction(tx['otherTrans'], tx)

		if 'signatures' in tx:
			for sig in tx['signatures']:
				self.addAccountTx(sig['signer'], tx)

	def calculateFee(self, tx):
		fee = tx['fee']
		if 'otherTrans' in tx:
			fee += tx['otherTrans']['fee']

		if 'signatures' in tx:
			for sig in tx['signatures']:
				fee += sig['fee']
		return fee

	def processBlock(self, blockData):
		block = blockData["block"] 
		blockHarvesterAddress = pk2address(block['signer'])
		print "block height:", block['height'], blockHarvesterAddress,
		
		block['hash'] = blockData['hash']

		if len(self.redis_client.zrangebyscore('blocks', block['height'], block['height'])) >= 1:
			print int(json.loads(zlib.decompress(self.redis_client.zrangebyscore('blocks', block['height'], block['height'])[0]))['height'])
			self.lastHeight = block['height']
			return
		print "processing block height:", block['height'], blockHarvesterAddress

		#if self.seen_blocks >= block['height']:
		#	return
		#else:
		#	self.seen_blocks = block['height']
			
		block['timestamp_unix'] = self._calc_unix(block['timeStamp'])
		block['timestamp'] = self._calc_timestamp(block['timestamp_unix'])
		
		fees_total = 0
		
		txes = blockData["txes"]
		block['txes'] = []
		
		for txData in txes:
			if not ('tx' in txData):
				tx = txData
				txData = {}
				txData['tx'] = tx
				txData['hash'] = tx['signature'][0:64]
			tx = txData['tx']
			tx['hash'] = txData['hash']

			timestamps_unix = self._calc_unix(tx['timeStamp'])
			tx['timestamp'] = self._calc_timestamp(timestamps_unix)
			tx['block'] = block['height']
			
			fees_total += self.calculateFee(tx);
			
			#save tx in redis
			self.redis_client.set(txData['hash'], tornado.escape.json_encode(tx))
			self.redis_client.zadd('tx', timestamps_unix, tornado.escape.json_encode(tx))
			self.redis_client.publish('tx_channel', tornado.escape.json_encode(tx))
			self.processTransaction(tx)
			block['txes'].append(tx)
		
		#save blocks in redis
		self.redis_client.zadd('blocks', block['height'], zlib.compress(tornado.escape.json_encode(block), 9))
		print "after add",  len(self.redis_client.zrangebyscore('blocks', block['height'], block['height']))

		self.redis_client.set(blockData['hash'], tornado.escape.json_encode(block))
		self.redis_client.publish('block_channel', tornado.escape.json_encode(block))
		
		self.redis_client.zincrby('harvesters', blockHarvesterAddress, 1.0)
		self.redis_client.zincrby('fees_earned', blockHarvesterAddress, fees_total)


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
			if self.redis_client.zcard('blocks') == 0:
				response = yield self.api.getfirstblock()
				blockData = {}
				blockData["block"] = json.loads(response.body)
				blockData["txes"] = blockData['block']['transactions']
				blockData['hash'] = blockData['block']['signature'][0:64]
				self.processBlock(blockData)

			height = self.lastHeight
			print "getting blocks at ", height
			response = yield self.api.getblocksafter(height)
			for blockData in json.loads(response.body)['data']:
				self.processBlock(blockData)
		except:
			print "exception"
			traceback.print_exc()
		
		self.findLastHeight()

