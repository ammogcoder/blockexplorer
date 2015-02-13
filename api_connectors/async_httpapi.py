'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

import urllib
import urlparse
import ujson as json
import tornado.httpclient


class AHttpApi():
	def __init__(self, baseurl):
		self.base_url = baseurl
		self.http_client = tornado.httpclient.AsyncHTTPClient()
	
	def _getrequest(self, callurl, **kwargs):
		data = urllib.urlencode(kwargs)
		if not data:
			url = urlparse.urljoin(self.base_url, callurl)
		else:
			url = urlparse.urljoin(self.base_url, callurl % data)
		req = tornado.httpclient.HTTPRequest(url, connect_timeout=1.0, request_timeout=10.0)
		return self.http_client.fetch(req)
	
	def _postrequest(self, callurl, data):
		return self.http_client.fetch(urlparse.urljoin(self.base_url, callurl),
										  method='POST', 
										  headers={'Content-Type': 'application/json'}, 
										  body=data)
		
	def getFirstBlock(self):
		data = json.dumps({'height':1})
		return self._postrequest('/block/at/public', data)
 
	def getBlocksAfter(self, height):
		data = json.dumps({'height': height})
		return self._postrequest('/local/chain/blocks-after/', data)
	
	def getAccount(self, id):
		return self._getrequest('account/get?%s', address=id)
	
	#TODO: this is not yet implemented in NIS so I'll have to adapt accordingly
	def getTx(self, id):
		return self._getrequest('transaction/get?%s', signature=id)
	
	def getAllTxForAccount(self, id):
		return self._getrequest('account/transfers/all?%s', address=id)
	
	def getPeerList(self):
		return self._getrequest('node/peer-list/all')

	def getLastBlock(self):
		return self._getrequest('chain/last-block')

	def getNodeInfo(self):
		return self._getrequest('node/info')

