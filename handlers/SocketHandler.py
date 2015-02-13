'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

import tornado.gen
import tornadoredis
import tornado.websocket

class LatestSocket(tornado.websocket.WebSocketHandler):
    
    channel = 'block_channel'
    
    @tornado.gen.engine
    def open(self):
        self.client = tornadoredis.Client()
        self.client.connect()
        yield tornado.gen.Task(self.client.subscribe, self.channel)
        self.client.listen(self.on_message)

    def on_message(self, msg):
        if msg.kind == 'message':
            self.write_message(msg.body)
        if msg.kind == 'disconnect':
            self.close()
        
    def on_close(self):
        if self.client.subscribed:
            self.client.unsubscribe(self.channel)
            self.client.disconnect()
            
    def check_origin(self, origin):
        return True

class LatestBlockSocket(LatestSocket):
    channel = 'block_channel'

class LatestTxSocket(LatestSocket):
    channel = 'tx_channel'
