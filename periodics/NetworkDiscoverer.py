'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''
import redis
import tornado.gen
import ujson as json
import traceback
import zlib
from api_connectors import async_httpapi
from ConfigParser import SafeConfigParser
from periodics.BasePeriodic import BasePeriodic

class NetworkDiscoverer(BasePeriodic):
     
    @tornado.gen.coroutine
    def run(self):
        try:
            #get neighbors
            active_nodes = {}
            response = yield self.api.getpeerlist()
            for node in json.loads(response.body)['active']:
                active_nodes[node['endpoint']['host']] = node
            
            #discover nodes beyond neighbors
            for host, data in active_nodes.items():
                target_host = '%s://%s:%d' % (data['endpoint']['protocol'], host, data['endpoint']['port'])
                node_api = async_httpapi.AHttpApi(target_host)
                response = yield self.api.getpeerlist()
                node_peers = json.loads(response.body)['active']
                for peer in node_peers:
                    if peer['endpoint']['host'] not in active_nodes.keys():
                       print 'NEW PEER: ', peer
        except:
            traceback.print_exc()