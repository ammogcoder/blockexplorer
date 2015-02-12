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
	 
	@tornado.gen.coroutine
	def run(self):
		try:
			#get neighbors
			activeNodes = {}
			response = yield self.api.getpeerlist()
			allHosts = set()
			processedHosts = set()
			realActiveNodes = {}
			for node in json.loads(response.body)['active']:
				allHosts.add(node['endpoint']['host'])
				activeNodes[node['endpoint']['host']] = node
			print 'running network discovery'
			print activeNodes
			
			while len(allHosts) > 0:
				print "HOSTS LEFT %d PROCESSED %d" % (len(allHosts), len(processedHosts))
				host = allHosts.pop()
				processedHosts.add(host)
				data = activeNodes[host]
				target_host = '%s://%s:%d' % (data['endpoint']['protocol'], host, data['endpoint']['port'])
				node_api = async_httpapi.AHttpApi(target_host)
				try:
					response = yield node_api.getlastblock()
					height = json.loads(response.body)['height']
					print '%s last block: %s' % (host, height)
					realActiveNodes[host] = activeNodes[host]
					realActiveNodes[host]['metaData']['height'] = height
				except:
					print 'Error communitcating with %s' % target_host
					continue

				try:
					response = yield node_api.getpeerlist()
					node_peers = json.loads(response.body)['active']
					for peer in node_peers:
						newNode = peer['endpoint']['host']
						if (newNode not in allHosts) and (newNode not in processedHosts):
							activeNodes[newNode] = peer
				except:
					print 'Error communitcating with %s' % target_host
			self.redis_client.set('active_nodes', json.dumps(realActiveNodes))
		except:
			traceback.print_exc()
