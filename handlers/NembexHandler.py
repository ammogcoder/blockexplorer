'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

import tornado.locale
import tornado.gen
import ujson as json
from handlers.BaseHandler import BaseHandler
from periodics import RedisConnector

class NembexHandler(BaseHandler):
	
	def get(self):
		redis_client = RedisConnector.RedisConnector.redis_client		
		response = redis_client.zrange('blocks', 0, 2, 'desc')[0]
		tornado.locale.set_default_locale(self.session.get("locale", ""))
		self.render("base.html", lastblock=json.loads(response), lblocks=None)