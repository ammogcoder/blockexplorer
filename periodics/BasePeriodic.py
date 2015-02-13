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


class BasePeriodic(object):
    
    def __init__(self):
        self.parser = SafeConfigParser()
        self.parser.read('settings.INI')
	hostname = self.parser.get("blockexplorer", "node")
        self.api = async_httpapi.AHttpApi(baseurl=hostname)
        self.redis_client = redis.StrictRedis(host='localhost', port=6379, db=12)
        
    @tornado.gen.coroutine
    def run(self):
        raise Exception("NotImplementedException")
