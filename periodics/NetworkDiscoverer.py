'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import tornado.gen
import ujson as json
import traceback
from datetime import datetime
from api_connectors import async_httpapi
from periodics.BasePeriodic import BasePeriodic

def isValidIp(address):
	try:
		host_bytes = address.split('.')
		valid = [int(b) for b in host_bytes]
		valid = [b for b in valid if b >= 0 and b<=255]
		return len(host_bytes) == 4 and len(valid) == 4
	except:
		return False

class Col:
	Success = '\033[1;37;42m'
	Error = '\033[30;41m'
	Special = '\033[30;4;41m'
	Endl = '\033[0m'

def error(*args):
	print Col.Error,
	for arg in args:
		print arg,
	print Col.Endl

	fp = open('logfile', 'a')
	fp.write("xx: ")
	for arg in args:
		fp.write(arg)
	fp.write("\n")
	fp.close()


def success(*args):
	print Col.Success,
	for arg in args:
		print arg,
	print Col.Endl

	fp = open('logfile', 'a')
	fp.write("OK: ")
	for arg in args:
		fp.write(arg)
	fp.write("\n")
	fp.close()

class NetworkDiscoverer(BasePeriodic):
	def __init__(self):
		super(NetworkDiscoverer, self).__init__()
		self.activeNodes = {}
		self.allHosts = set()
		self.processedHosts = set()
		self.realActiveNodes = {}

	def addActiveNodes(self, parentNode, response):
		for node in json.loads(response.body)['active']:
			hostname = node['endpoint']['host']
			if hostname == 'localhost':
				print Col.Special, '>>>', node, Col.Endl
				continue
			endpoint = self.getEndpoint(node)
			success('in %s have %s' % (parentNode, node))
			if (endpoint not in self.allHosts) and (endpoint not in self.processedHosts):
				self.allHosts.add(endpoint)
				self.activeNodes[endpoint] = node

	def fillChecks(self, target_host, node, oldNodes):
		if (target_host in oldNodes) and ('checks' in oldNodes[target_host]):
			node['checks'] = oldNodes[target_host]['checks']
			print "HOST restored checks: ", node['checks']
		else:
			node['checks'] = [0,0]
		
	def getEndpoint(self, data):
		return '%s://%s:%d' % (data['endpoint']['protocol'], data['endpoint']['host'], data['endpoint']['port'])


	@tornado.gen.coroutine
	def run(self):
		try:
			oldNodes = json.loads((self.redis_client.get('active_nodes') or "{}"))
			self.activeNodes = {}
			self.allHosts = set()
			self.processedHosts = set()
			self.realActiveNodes = {}

			#get neighbors
			response = yield self.api.getPeerList()
			self.addActiveNodes('localhost', response)
			print 'running network discovery'
			
			start = datetime.utcnow()
			while len(self.allHosts) > 0:
				success("HOSTS LEFT %d PROCESSED %d" % (len(self.allHosts), len(self.processedHosts)))
				target_host = self.allHosts.pop()
				self.processedHosts.add(target_host)
				node_api = async_httpapi.AHttpApi(target_host)
				seenByOthers = self.activeNodes[target_host]
				try:
					response = yield node_api.getNodeInfo()
					seenByOthers = json.loads(response.body)
				except:
					error('ERROR[0] communitcating with %s' % target_host)
					pass

				if 'nisInfo' in seenByOthers:
					temp = seenByOthers['nisInfo']
					seenByOthers = seenByOthers['node']
					seenByOthers['nisInfo'] = temp
				self.realActiveNodes[target_host] = seenByOthers
				if self.realActiveNodes and (target_host in self.realActiveNodes) and self.realActiveNodes[target_host] and ('name' in self.realActiveNodes[target_host]['identity']):
					if self.realActiveNodes[target_host]['identity']['name'] is None:
						self.realActiveNodes[target_host]['identity']['name'] = ""
					print "HOST: ", target_host
					print self.realActiveNodes[target_host]
					self.realActiveNodes[target_host]['identity']['name'] = self.realActiveNodes[target_host]['identity']['name'][0:128]


				self.fillChecks(target_host, self.realActiveNodes[target_host], oldNodes)
				self.realActiveNodes[target_host]['checks'][0] += 1
				if isValidIp(seenByOthers['endpoint']['host']):
					seenByOthers['endpoint']['host'] = '.'.join(seenByOthers['endpoint']['host'].split('.')[0:2] + ['xx', 'xx'])
				print 'HOST %s nem name %s ' % (target_host, self.realActiveNodes[target_host]['identity']['name'])
				try:
					response = yield node_api.getLastBlock()
					height = json.loads(response.body)['height']
					print '%s last block: %s' % (target_host, height)
					self.realActiveNodes[target_host]['metaData']['height'] = height
					self.realActiveNodes[target_host]['checks'][1] += 1
				except:
					self.realActiveNodes[target_host]['metaData']['height'] = 0
					error('ERROR[1] communitcating with %s' % target_host)
					continue

				try:
					response = yield node_api.getPeerList()
					print 'adding nodes seen by HOST %s' % (target_host)
					self.addActiveNodes(target_host, response)
				except:
					error('ERROR[2] communitcating with %s' % target_host)
			self.redis_client.set('active_nodes', json.dumps(self.realActiveNodes))
			print self.realActiveNodes

			end = datetime.utcnow()
			success("Time taken: %s" % str(end-start))
			self.redis_client.set('nodes_last_time', end)	
		except:
			traceback.print_exc()
