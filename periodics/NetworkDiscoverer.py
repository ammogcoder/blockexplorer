'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import tornado.gen
import ujson as json
import traceback
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

def success(*args):
	print Col.Success,
	for arg in args:
		print arg,
	print Col.Endl

class NetworkDiscoverer(BasePeriodic):
	def __init__(self):
		super(NetworkDiscoverer, self).__init__()
		self.activeNodes = {}
		self.allHosts = set()
		self.processedHosts = set()
		self.realActiveNodes = {}

	def addActiveNodes(self, response):
		for node in json.loads(response.body)['active']:
			hostname = node['endpoint']['host']
			if hostname == 'localhost':
				print Col.Special, '>>>', node, Col.Endl
				continue
			if (hostname not in self.allHosts) and (hostname not in self.processedHosts):
				self.allHosts.add(hostname)
				self.activeNodes[hostname] = node
					
	def fillChecks(self, node, oldNodes):
		hostname = node['endpoint']['host']
		if (hostname in oldNodes) and ('checks' in oldNodes[hostname]):
			node['checks'] = oldNodes[hostname]['checks']
			print "HOST restored checks: ", node['checks']
		else:
			node['checks'] = [0,0]
		
	def getEndpoint(self, hostname):
		data = self.activeNodes[hostname]
		return '%s://%s:%d' % (data['endpoint']['protocol'], hostname, data['endpoint']['port'])


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
			self.addActiveNodes(response)
			print 'running network discovery'
			
			while len(self.allHosts) > 0:
				success("HOSTS LEFT %d PROCESSED %d" % (len(self.allHosts), len(self.processedHosts)))
				host = self.allHosts.pop()
				self.processedHosts.add(host)
				target_host = self.getEndpoint(host)
				node_api = async_httpapi.AHttpApi(target_host)
				seenByOthers = self.activeNodes[host]
				try:
					response = yield node_api.getNodeInfo()
					seenByOthers = json.loads(response.body)
				except:
					error('ERROR[0] communitcating with %s' % target_host)
					pass

				self.realActiveNodes[host] = seenByOthers
				self.fillChecks(self.realActiveNodes[host], oldNodes)
				self.realActiveNodes[host]['checks'][0] += 1
				if isValidIp(seenByOthers['endpoint']['host']):
					seenByOthers['endpoint']['host'] = '.'.join(seenByOthers['endpoint']['host'].split('.')[0:2] + ['xx', 'xx'])
				print 'HOST %s nem name %s ' % (host, self.realActiveNodes[host]['identity']['name'])
				try:
					response = yield node_api.getLastBlock()
					height = json.loads(response.body)['height']
					print '%s last block: %s' % (host, height)
					self.realActiveNodes[host]['metaData']['height'] = height
					self.realActiveNodes[host]['checks'][1] += 1
				except:
					self.realActiveNodes[host]['metaData']['height'] = 0
					error('ERROR[1] communitcating with %s' % target_host)
					continue

				try:
					response = yield node_api.getPeerList()
					print 'adding nodes seen by HOST %s' % (target_host)
					self.addActiveNodes(response)
				except:
					error('ERROR[2] communitcating with %s' % target_host)
			self.redis_client.set('active_nodes', json.dumps(self.realActiveNodes))
		except:
			traceback.print_exc()
