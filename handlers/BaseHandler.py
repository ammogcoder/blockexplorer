'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

import tornado.web
import redis
from pycket.session import SessionMixin
from ConfigParser import SafeConfigParser
from periodics import RedisConnector
from api_connectors import async_httpapi

class BaseHandler(tornado.web.RequestHandler, SessionMixin):
	def __init__(self, *args, **kwargs):	
		super(BaseHandler, self).__init__(*args, **kwargs)
		self.user = self.session.get('user', None)
		locale = self.session.get('locale', "")
		self.parser = SafeConfigParser()
		self.parser.read("settings.INI")
		self.redis_client = redis.StrictRedis(host='localhost', port=6379, db=12)
		self.api = async_httpapi.AHttpApi()