#!/usr/bin/env python
# -*- coding: utf-8 -*- 
from handlers.BaseHandler import BaseHandler


class LocaleHandler(BaseHandler):

	def get(self, locale):
		self.session.set('locale', locale)		
		self.redirect('/')
		

		

		