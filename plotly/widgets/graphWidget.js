window.genUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
};

require(["widgets/js/widget"], function(WidgetManager){

    var GraphView = IPython.DOMWidgetView.extend({
        render: function(){
            var that = this;

            var graphId = window.genUID();
            var loadingId = 'loading-'+graphId;


            var _graph_url = that.model.get('_graph_url');

            // variable plotly_domain in the case of enterprise
            var url_parts = _graph_url.split('/');
            var plotly_domain = url_parts[0] + '//' + url_parts[2];

            // Place IFrame in output cell div `$el`
            that.$el.css('width', '100%');
            that.$graph = $(['<iframe id="'+graphId+'"',
                             'src="'+_graph_url+'.embed"',
                             'seamless',
                             'style="border: none;"',
                             'width="100%"',
                             'height="600">',
                             '</iframe>'].join(' '));
            that.$graph.appendTo(that.$el);

            that.$loading = $('<div id="'+loadingId+'">Initializing...</div>')
                            .appendTo(that.$el);

            // initialize communication with the iframe
            if(!('pingers' in window)){
                window.pingers = {};
            }

            window.pingers[graphId] = setInterval(function() {
                that.graphContentWindow = $('#'+graphId)[0].contentWindow;
                that.graphContentWindow.postMessage({task: 'ping'}, plotly_domain);
            }, 200);

            // Assign a message listener to the 'message' events
            // from iframe's postMessage protocol.
            // Filter the messages by iframe src so that the right message
            // gets passed to the right widget
            if(!('messageListeners' in window)){
                 window.messageListeners = {};
            }

            window.messageListeners[graphId] = function(e) {
                if(_graph_url.indexOf(e.origin)>-1) {
                    var frame = document.getElementById(graphId);

                    if(frame === null){
                        // frame doesn't exist in the dom anymore, clean up it's old event listener
                        window.removeEventListener('message', window.messageListeners[graphId]);
                        clearInterval(window.pingers[frameId]);
                        clearInterval(window.pingers[graphId]);
                    } else if(frame.contentWindow === e.source) {
                        // TODO: Stop event propagation, so each frame doesn't listen and filter
                        var frameContentWindow = $('#'+graphId)[0].contentWindow;
                        var message = e.data;

                        if(message==='pong') {
                            $('#loading-'+graphId).hide();
                            clearInterval(window.pingers[graphId]);
                            that.send({event: 'pong', graphId: graphId});
                        } else if (message.type==='hover' ||
                                   message.type==='zoom'  ||
                                   message.type==='click' ||
                                   message.type==='unhover') {
                            that.send({event: message.type, message: message, graphId: graphId});
                        }
                    }
                }
            };

            window.removeEventListener('message', window.messageListeners[graphId]);
            window.addEventListener('message', window.messageListeners[graphId]);

        },

        update: function() {
            // Listen for messages from the graph widget in python
            var jmessage = this.model.get('_message');

            var message = JSON.parse(jmessage);

            // check for duplicate messages
            if(!('messageIds' in window)){
                window.messageIds = {};
                window.messageIds[message.uid] = true;
            }

            if(!(message.uid in window.messageIds)){
                // message hasn't been received yet, do stuff
                window.messageIds[message.uid] = true;

                var plot = $('#'+message.graphId)[0].contentWindow;
                plot.postMessage(message, this.model.get('_plotly_domain'));
            }

            return GraphView.__super__.update.apply(this);
        }
    });

    // Register the GraphView with the widget manager.
    WidgetManager.register_widget_view('GraphView', GraphView);
});

//@ sourceURL=graphWidget.js
