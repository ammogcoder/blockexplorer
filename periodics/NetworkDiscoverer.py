'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import tornado.gen
import ujson as json
import traceback
import zlib
from api_connectors import async_httpapi
from periodics.BasePeriodic import BasePeriodic

class NetworkDiscoverer(BasePeriodic):
	def __init__(self):
		super(NetworkDiscoverer, self).__init__()
		self.activeNodes = {}
		self.allHosts = set()
		self.processedHosts = set()
		self.realActiveNodes = {}

	def addActiveNodes(self, response, oldNodes):
		for node in json.loads(response.body)['active']:
			hostname = node['endpoint']['host']
			if (hostname not in self.allHosts) and (hostname not in self.processedHosts):
				self.allHosts.add(hostname)
				self.activeNodes[hostname] = node
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
			oldNodes = json.loads(self.redis_client.get('active_nodes'))
			self.activeNodes = {}
			self.allHosts = set()
			self.processedHosts = set()
			self.realActiveNodes = {}

			#get neighbors
			response = yield self.api.getPeerList()
			self.addActiveNodes(response, oldNodes)
			print 'running network discovery'
			
			while len(self.allHosts) > 0:
				print "HOSTS LEFT %d PROCESSED %d" % (len(self.allHosts), len(self.processedHosts))
				host = self.allHosts.pop()
				self.processedHosts.add(host)
				target_host = self.getEndpoint(host)
				node_api = async_httpapi.AHttpApi(target_host)
				self.realActiveNodes[host] = self.activeNodes[host]
				self.realActiveNodes[host]['checks'][0] += 1
				print 'HOST %s nem name %s ' % (host, self.realActiveNodes[host]['identity']['name'])
				try:
					response = yield node_api.getLastBlock()
					height = json.loads(response.body)['height']
					print '%s last block: %s' % (host, height)
					self.realActiveNodes[host]['metaData']['height'] = height
					self.realActiveNodes[host]['checks'][1] += 1
				except:
					self.realActiveNodes[host]['metaData']['height'] = 0
					print 'ERROR[1] communitcating with %s' % target_host
					continue

				try:
					response = yield node_api.getPeerList()
					self.addActiveNodes(response, oldNodes)
					print 'HOST %s processed' % (target_host)
				except:
					print 'ERROR[2] communitcating with %s' % target_host
			self.redis_client.set('active_nodes', json.dumps(self.realActiveNodes))
		except:
			traceback.print_exc()
