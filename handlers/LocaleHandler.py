'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

from handlers.BaseHandler import BaseHandler


class LocaleHandler(BaseHandler):

	def get(self, locale):
		self.session.set('locale', locale)		
		self.redirect('/')
		

		

		