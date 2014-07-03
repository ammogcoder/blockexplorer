'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

import tornado.gen
import tornadoredis
import tornado.websocket

class LatestBlockSocket(tornado.websocket.WebSocketHandler):

    @tornado.gen.engine
    def open(self):
        self.client = tornadoredis.Client()
        self.client.connect()
        yield tornado.gen.Task(self.client.subscribe, 'block_channel')
        self.client.listen(self.on_message)

    def on_message(self, msg):
        if msg.kind == 'message':
            self.write_message(msg.body)
        if msg.kind == 'disconnect':
            self.close()
        
    def on_close(self):
        if self.client.subscribed:
            self.client.unsubscribe('block_channel')
            self.client.disconnect()

class LatestTxSocket(tornado.websocket.WebSocketHandler):

    @tornado.gen.engine
    def open(self):
        self.client = tornadoredis.Client()
        self.client.connect()
        yield tornado.gen.Task(self.client.subscribe, 'tx_channel')
        self.client.listen(self.on_message)

    def on_message(self, msg):
        if msg.kind == 'message':
            self.write_message(msg.body)
        if msg.kind == 'disconnect':
            self.close()
        
    def on_close(self):
        if self.client.subscribed:
            self.client.unsubscribe('tx_channel')
            self.client.disconnect()
