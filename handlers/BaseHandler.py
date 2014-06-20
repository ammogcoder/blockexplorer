#!/usr/bin/env python
# -*- coding: utf-8 -*- 
import tornado.web
from pycket.session import SessionMixin

class BaseHandler(tornado.web.RequestHandler, SessionMixin):
	def get_current_user(self):
		user = self.session.get('user')
		if not user:
			return None
		return user
	
	def get_current_locale(self):
		return self.session.get('locale', "")