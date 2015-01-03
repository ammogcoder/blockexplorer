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
            active_nodes = {}
            response = yield self.api.getpeerlist()
            for node in json.loads(response.body)['active']:
                active_nodes[node['endpoint']['host']] = node
            
            #discover nodes beyond neighbors
            for host, data in active_nodes.items():
                target_host = '%s://%s:%d' % (data['endpoint']['protocol'], host, data['endpoint']['port'])
                node_api = async_httpapi.AHttpApi(target_host)
                try:
                    response = yield node_api.getpeerlist()
                except:
                    print 'Error communitcating with %s' % target_host
                node_peers = json.loads(response.body)['active']
                for peer in node_peers:
                    if peer['endpoint']['host'] not in active_nodes.keys():
                       active_nodes[peer['endpoint']['host']] = peer
            self.redis_client.set('active_nodes', json.dumps(active_nodes))
        except:
            traceback.print_exc()