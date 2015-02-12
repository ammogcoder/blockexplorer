'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

import urllib
import urlparse
import ujson as json
import tornado.httpclient


class AHttpApi():
    def __init__(self, baseurl='http://chain.nem.ninja:7890'):
        self.base_url = baseurl
        self.http_client = tornado.httpclient.AsyncHTTPClient()
    
    def _getrequest(self, callurl, **kwargs):
        data = urllib.urlencode(kwargs)
        
        if not data:
            response = self.http_client.fetch(urlparse.urljoin(self.base_url, callurl))
        else:
            response = self.http_client.fetch(urlparse.urljoin(self.base_url, callurl % data))            
        return response
    
    def _postrequest(self, callurl, data):
        return self.http_client.fetch(urlparse.urljoin(self.base_url, callurl),
                                          method='POST', 
                                          headers={'Content-Type': 'application/json'}, 
                                          body=data)
        
    def getlastblock(self):
        return self._getrequest('/chain/last-block/')

    def getfirstblock(self):
   	data = json.dumps({'height':1})
        return self._postrequest('/block/at/public', data)
 
    def getblocksafter(self, height):
        data = json.dumps({'height': height})
        return self._postrequest('/local/chain/blocks-after/', data)
    
    def getaccount(self, id):
        return self._getrequest('account/get?%s', address=id)
    
    #TODO: this is not yet implemented in NIS so I'll have to adapt accordingly
    def gettx(self, id):
        return self._getrequest('transaction/get?%s', signature=id)
    
    def getalltxforaccount(self, id):
        return self._getrequest('account/transfers/all?%s', address=id)
    
    def getpeerlist(self):
        return self._getrequest('node/peer-list/all')

    def getlastblock(self):
        return self._getrequest('chain/last-block')
