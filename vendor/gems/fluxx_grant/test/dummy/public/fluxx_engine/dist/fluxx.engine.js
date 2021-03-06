(function($){
  _.mixin({
    addUp: function (set, property) {
      var args = _.toArray(arguments).slice(2);
      return _.reduce($(set), 0, function(m,i){
        return m + $(i)[property].apply($(i), args);
      });
    },
    callAll: function () {
      var functions = _.toArray(arguments);
      return function() {
        var this_ = this;
        var args  = arguments;
        _.each(functions, function(f){f.apply(this_, args)});
      }
    },
    intersectProperties: function (one, two) {
      if (_.isEqual(one, two)) return one;

      var intersect = {};
      _.each(one, function (val, key) {
        if (_.isEqual(val, two[key])) intersect[key] = val;
      });
      return intersect;
    },
    isFilterMatch: function (filter, test) {
      return _.isEqual(
        (_.compose(_.size, _.intersectProperties))(filter, test),
        (_.compose(_.size, _.compact, _.values))(filter)
      );
    }
  });
  
  $.extend(true, {
    my: {
      cards: $()
    },
    fluxx: {
      config: {
        cards: $('.card'),
        realtime_updates: {
          enabled: false,
          options: {
            url: null
          }
        }
      },
      cache: {},
      realtime_updates: null,
      util: {
        options_with_callback: function(defaults, options, callback) {
          if ($.isFunction(options)) {
            options = {callback: options};
          } else if ($.isPlainObject(options) && $.isFunction(callback)) {
            options.callback = callback;
          }
          return $.extend({callback: $.noop}, defaults || {}, options || {});
        },
        resultOf: function (value) {
          if (_.isNull(value))     return '';
          if (_.isString(value))   return value;
          if ($.isArray(value))    return _.map(value,function(x){return $.fluxx.util.resultOf(x)}).join('');
          if ($.isFunction(value)) return arguments.callee(value.apply(value, _.tail(arguments)));
          if (_.isString(value.jquery))
            return $.fluxx.util.getSource(value);
          return value;
        },
        iconImage: function(name) {
          return $.fluxx.config.icon_path + '/' + name + '.png';
        },
        marginHeight: function($selector) {
          return parseInt($selector.css('marginTop')) + parseInt($selector.css('marginBottom'));
        },

        itEndsWithMe: function(e) {
          e.stopPropagation();
          e.preventDefault();
        },
        itEndsHere: function (e) {
          e.stopImmediatePropagation();
          e.preventDefault();
        },
        getSource: function (sel) {
          return _.map($(sel), function(i) { return $('<div>').html($(i).clone()).html();});
        },
        getTag: function (sel) {
          return _.map($(sel), function(i){return $('<div>').html($(i).clone().empty().html('...')).html()}).join(', ')
        },
        
        seconds: function (i) { return i * 1000; },
        minutes: function (i) { return i * 60 * 1000; }
      },
      logOn: true,
      log: function () {
        if (!$.fluxx.logOn) return;
        if (! this.logger) this.logger = (console && console.log ? _.bind(console.log, console) : $.noop);
        _.each(arguments, _.bind(function(a) { this.logger(a) }, this));
      }
    }
  });

  $(window).ajaxComplete(function(e, xhr, options) {
    $.fluxx.log('XHR: ' + options.type + ' ' + options.url + ' (' + unescape(options.data) + ')');
  });
  
  var keyboardShortcuts = {
    'Space+m': ['Show $.my cache', function() {
      $.fluxx.log('--- $.my CACHE BEGIN ---');
      _.each($.my, function(val,key) {
        $.fluxx.log(
          key +
          ' [' +
          val.length +
          ']: [' +
          $.fluxx.util.getTag(val) +
          ']'
        );
      });
      $.fluxx.log('--- $.my CACHE END ---');
    }],
    'Space+h': ['This help message', function() {
      $.fluxx.log.apply($.fluxx.log, _.map(keyboardShortcuts, function(v,k){return [k, v[0]].join(': ')}))
    }],
    'p+s': ['start/stop polling', function () {
      var rtu = $.fluxx.realtime_updates;
      if (!rtu) return;
      if (rtu.state) {
        $.fluxx.log('stoping rtu');
        rtu.stop();
      } else {
        $.fluxx.log('starting rtu');
        rtu.start();
      }
    }]
  };
  
  $(document).shortkeys(_.extend.apply(_, _.map(keyboardShortcuts, function(v,k){var o={}; o[k] = v[1]; return o})));
})(jQuery);

jQuery(function($){
  $.my.body = $('body');
});


(function($){

  var STATES = [ 'off', 'on' ],
      S_OFF  = 0,
      S_ON   = 1;
  
  function Poller(options) {
    var options = $.fluxx.util.options_with_callback($.fluxx.poller.defaults,options);
    options.id  = options.id();
    $.extend(this, $.fluxx.implementations[options.implementation]);
    $.extend(this, options);
    $.fluxx.pollers.push(this);
    this.$ = $(this);
    this.subscribe(this.update);
    this._init();
  }
  $.extend(Poller.prototype, {
    stateText: function () {
      return STATES[this.state];
    },
    start: function () {
      this.state = S_ON;
      this._start();
      /*$(window)
        .focusin(this.start)
        .focusout(this.stop);*/
      this.$.trigger('start.fluxx.poller');
    },
    stop: function () {
      this.state = S_OFF;
      this._stop();
      /*$(window)
        .unbind('focusin', this.start)
        .unbind('focusout', this.stop);*/
    },
    message: function (data, status) {
      ('update.fluxx.poller')
      this.$.trigger('update.fluxx.poller', data, status);
    },
    subscribe: function (fn) {
      this.$.bind('update.fluxx.poller', fn);
    },
    destroy: function () {
      $.fluxx.pollers = _.without($.fluxx.pollers, this);
      delete this;
    }
  });
  
  $.extend({
    fluxxPoller: function(options) {
      return new Poller(options);
    },
    fluxxPollers: function() {
      return $.fluxx.pollers;
    },
    destroyFluxxPollers: function () {
      _.each($.fluxx.pollers, function (poller) {
        poller.destroy();
      });
    }
  });
  
  $.extend(true, {
    fluxx: {
      pollers: [],
      poller: {
        defaults: {
          implementation: 'polling',
          state: S_OFF,
          update: $.noop,
          id: function(){ return _.uniqueId('fluxx-poller-'); }
        }
      },
      implementations: {
        polling: {
          interval: $.fluxx.util.seconds(5),
          last_id: '',
          decay: 1.2, /* not used presently */
          maxInterval: $.fluxx.util.minutes(60),
          
          _timeoutID: null,
          _init: function () {
            _.bindAll(this, 'start', 'stop', '_poll');
            this.last_id = $.cookie('last_id');
          },
          _poll: function () {
            if (this.state == S_OFF) return;
            var doPoll = _.bind(function(){
              $.getJSON(this.url, {last_id: this.last_id}, _.bind(function(data, status){
                this.last_id = data.last_id;
                $.cookie('last_id', this.last_id);
                this.message(data, status);
                this._poll();
              }, this));
            }, this);
            this._timeoutID = setTimeout(doPoll, this.interval);
          },
          _start: function () {
            this.$
              .unbind('start.fluxx.poller.polling')
              .bind('start.fluxx.poller.polling', _.bind(this._poll, this))
          },
          _stop: function () {
            clearTimeout(this._timeoutID);
          }
        }
      }
    }
  });

})(jQuery);
(function($){
  $.fn.extend({
    fluxxStage: function(options, onComplete) {
      var options = $.fluxx.util.options_with_callback({}, options, onComplete);
      return this.each(function(){
        $.my.fluxx  = $(this).attr('id', 'fluxx');
        $.my.stage  = $.fluxx.stage.ui.call(this, options).appendTo($.my.fluxx.empty());
        $.my.hand   = $('#hand');
        $.my.header = $('#header');
        $.my.footer = $('#footer');
        $.my.stage.bind({
          'complete.fluxx.stage': _.callAll(
            _.bind($.fn.setupFluxxPolling, $.my.stage),
            _.bind($.fn.installFluxxDecorators, $.my.stage),
            _.bind($.fn.addFluxxCards, $.my.hand, {cards: $.fluxx.config.cards}),
            $.colorbox.init,
            options.callback
          )
        });
        $.my.stage.trigger('complete.fluxx.stage');
      });
    },
    removeFluxxStage: function(onComplete) {
      var options = $.fluxx.util.options_with_callback({}, onComplete);
      return this.each(function(){
        if (!$.my.stage) return;
        $(this).remove();
        $.my.stage.trigger('unload.fluxx.stage');
        $.my.stage = undefined;
        $.my.hand  = undefined;
        $.my.cards = $('.card');
        options.callback.call(this);
      });
    },
    resizeFluxxStage: function(options, onComplete) {
      if (!this.length) return this;
      var options = $.fluxx.util.options_with_callback({}, options, onComplete);
      var allCards = _.addUp($.my.cards, 'outerWidth', true);
      $.my.stage
        .width(allCards)
        .bind('resize.fluxx.stage', options.callback)
        .trigger('resize.fluxx.stage');
      return this;
    },
    
    addFluxxCards: function(options) {
      var options = $.fluxx.util.options_with_callback({}, options);
      if (!options.cards.length) return this;
      $.each(options.cards, function() { $.my.hand.addFluxxCard(this) });
      return this;
    },
    
    installFluxxDecorators: function() {
      _.each($.fluxx.stage.decorators, function(val,key) {
        $(key).live.apply($(key), val);
      });
    },
    
    setupFluxxPolling: function () {
      if (! $.fluxx.config.realtime_updates.enabled) return;
      $.fluxx.realtime_updates = $.fluxxPoller($.fluxx.config.realtime_updates.options);
      $.fluxx.realtime_updates.start();
    }
  });
  
  $.extend(true, {
    fluxx: {
      stage: {
        attrs: {
          id: 'stage'
        },
        ui: function(optoins) {
          return $('<div>')
            .attr($.fluxx.stage.attrs)
            .html($.fluxx.util.resultOf([
              $.fluxx.stage.ui.header,
              $.fluxx.stage.ui.cardTable,
              $.fluxx.stage.ui.footer
            ]));
        },
        decorators: {
          'a.new-detail': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $.my.hand.addFluxxCard({
                detail: {url: $elem.attr('href')},
                title: ($elem.attr('title') || $elem.text())
              })
            }
          ],
          'a.new-listing': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $.my.hand.addFluxxCard({
                listing: {url: $elem.attr('href')},
                title: ($elem.attr('title') || $elem.text())
              })
            }
          ],
          'a.noop': [
            'click', $.fluxx.util.itEndsHere
          ],
          'a.as-put': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $elem.fluxxCardLoadContent({
                area: $elem.fluxxCardArea(),
                url: $elem.attr('href'),
                type: 'PUT'
              });
            }
          ],
          'a.as-post': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $elem.fluxxCardLoadContent({
                area: $elem.fluxxCardArea(),
                url: $elem.attr('href'),
                type: 'POST'
              });
            }
          ],
          'a.as-delete': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $elem.fluxxCardLoadContent({
                area: $elem.fluxxCardArea(),
                url: $elem.attr('href'),
                type: 'DELETE'
              });
            }
          ],
          'a.refresh-card': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              $(this).fluxxCardAreas().refreshCardArea();
            }
          ],
          'a.open-filters': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              if ($('.filters', $(this).fluxxCard()).length) {
                $(this).closeListingFilters();
              } else {
                $(this).openListingFilters();
              }
            },
            function(e) {
              $.fluxx.util.itEndsWithMe(e);
            }
          ],
          'select[data-related-child]': [
            'change', function (e) {
              var $parent   = $(this),
                  parentId  = $parent.val(),
                  $child    = $($parent.attr('data-related-child'), $parent.parents('form').eq(0)),
                  query     = {};
              query[$child.attr('data-param')] = parentId;
              $.getJSON($child.attr('data-src'), query, function(data, status) {
                $child.html('<option></option>');
                _.each(data, function(i){ $('<option></option>').val(i.value).html(i.label).appendTo($child)  });
              });
            }
          ],
          'a.to-upload': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $.colorbox({
                html: '<div class="upload-queue"></div>',
                width: 700,
                height: 400,
                onComplete: function () {
                  $.fluxx.log("onComplete start");
                  $('.upload-queue').pluploadQueue({
                    url: $elem.attr('href'),
                    runtimes: 'html5',
                    multipart: false,
                    filters: [{title: "Allowed file types", extensions: $elem.attr('data-extensions')}]
                  });
                  $.fluxx.log("onComplete stop");
                }
              });
            }
          ],
          'a.to-modal': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $elem.openCardModal({
                url:    $elem.attr('href'),
                header: $elem.attr('title') || $elem.text(),
                target: $elem
              });
            }
          ],
          'a.close-modal': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              $(this).closeCardModal();
            }
          ],
          'a.to-self':   [
            'click', function (e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $elem.fluxxCardLoadContent({
                url: $elem.attr('href'),
                area: $elem.fluxxCardArea()
              });
            }
          ],
          'a.to-listing': [
            'click', function (e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $elem.fluxxCardLoadListing({
                url: $elem.attr('href')
              });
            }
          ],
          'form.to-listing': [
            'submit', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $elem.fluxxCardLoadListing({
                url: $elem.attr('action'),
                type: $elem.attr('method'),
                data: $elem.serializeArray()
              });
            }
          ],
          'form.filters-form': [
            'submit', function(e) {
              var $elem = $(this);
              $elem.closeListingFilters();
            }
          ],
          'li.entry a': [
            'click', function(e) {
              var $elem = $(this);
              var $entry = $elem.parent();
              $entry.removeClass('latest').addClass('selected').siblings().removeClass('selected');
            }
          ],
          'a.close-card': [
            'click', function(e) {
              $.fluxx.util.itEndsWithMe(e);
              $(this).removeFluxxCard();
            }
          ],
          'a.to-detail': ['click', function (e) {
            $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              $elem.fluxxCardLoadDetail({
                url: $elem.attr('href')
              });
            }
          ],
          'a.area-url': [
            'click', function(e) {
              var $elem = $(this);
              $elem.attr('href', $elem.fluxxCardAreaURL());
            }
          ],
          'a.area-data': [
            'click', function(e) {
              var $elem = $(this);
              $elem.attr('href', $elem.attr('href') + '?' + $.param($elem.fluxxCardAreaData()))
            }
          ],
          'form.area-url': [
            'submit', function(e) {
              var $elem = $(this);
              $elem.attr('action', $elem.fluxxCardAreaURL({without: $elem.serializeArray()}));
            }
          ],
          'form.to-self': [
            'submit', function (e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              var properties = {
                area: $elem.fluxxCardArea(),
                url: $elem.attr('action'),
                data: $elem.serializeArray()
              };
              if ($elem.attr('method'))
                properties.type = $elem.attr('method');
              $elem.fluxxCardLoadContent(properties)
            },
          ],
          'input[data-autocomplete]': [
            'focus', function (e) {
              $.fluxx.util.itEndsWithMe(e);
              var $elem = $(this);
              if ($elem.data('autocomplete_initialized')) return;
              $elem.data('autocomplete_initialized', 1);

              var endPoint = $elem.attr('data-autocomplete');
              
              $elem.autocomplete({
                source: function (query, response) {
                  $.getJSON(
                    endPoint,
                    query,
                    function(data, status){
                      response(data);
                    }
                  );
                },
                focus: function (e, ui) {
                  $elem.val(ui.item.label);
                  return false;
                },
                select: function (e, ui) {
                  $elem.val(ui.item.label);
                  $elem
                    .parent()
                    .find('input[data-sibling='+ $elem.attr('data-sibling') +']')
                    .not($elem)
                    .val(ui.item.value)
                    .change();
                  return false;
                }
              });
            }
          ]
        }
      }
    }
  });
  $.fluxx.stage.ui.header = [
    '<div id="header">',
      '<div id="logo"><a href=".">FLUXX</a></div>',
      '<ul class="actions">',
      '</ul>',
    '</div>'
  ].join('');
  $.fluxx.stage.ui.cardTable = [
    '<div id="card-table">',
      '<ul id="hand">',
      '</ul>',
    '</div>'
  ].join('');
  $.fluxx.stage.ui.footer = [
    '<div id="footer"></div>'
  ].join('');
  
  $(window).resize(function(e){
    if (!$.my.stage) return;
    $.my.stage.resizeFluxxStage();
  });

})(jQuery);
(function($){
  $.fn.extend({
    addFluxxCard: function(options, onComplete) {
      var options = $.fluxx.util.options_with_callback($.fluxx.card.defaults,options,onComplete);
      return this.each(function(){
        var $card = $.fluxx.card.ui.call($.my.hand, options)
          .hide()
          .appendTo($.my.hand);
        $card
          .data({
            listing: $('.listing:eq(0)',   $card),
            detail:  $('.detail:eq(0)',    $card),
            box:     $('.card-box:eq(0)',  $card),
            body:    $('.card-body:eq(0)', $card)
          })
          .bind({
            'complete.fluxx.card': _.callAll(
              $.fluxx.util.itEndsHere,
              function(){$card.show();},
              _.bind($.fn.resizeFluxxCard, $card),
              _.bind($.fn.subscribeFluxxCardToUpdates, $card),
              options.callback
            ),
            'load.fluxx.card': options.load,
            'close.fluxx.card': options.close,
            'unload.fluxx.card': options.unload,
            'update.fluxx.card': _.callAll(
              _.bind($.fn.updateFluxxCard, $card),
              options.update
            )
          });
        $('.updates', $card).hide();
        $card.trigger('load.fluxx.card');
        $card.fluxxCardListing().bind({
          'listing_update.fluxx.area': _.bind($.fn.fluxxListingUpdate, $card.fluxxCardListing()),
          'get_update.fluxx.area': _.bind($.fn.getFluxxListingUpdate, $card.fluxxCardListing())
        });
        $('.updates', $card).click(
          function(e) { $card.fluxxCardListing().trigger('get_update.fluxx.area'); }
        );
        $card.fluxxCardLoadListing({url: options.listing.url}, function(){
          $card.fluxxCardLoadDetail({url: options.detail.url}, function(){
            $card.trigger('complete.fluxx.card');
          })
        });
        $.my.cards = $('.card');
      });
    },
    subscribeFluxxCardToUpdates: function () {
      return this.each(function(){
        if (!$.fluxx.realtime_updates) return;

        var $card = $(this);
        $.fluxx.realtime_updates.subscribe(function(e, data, status) {
          $.fluxx.log("Found " + data.deltas.length + " deltas.");
          var poller = e.target;
          $card.fluxxCardAreas().each(function(){
            var $area = $(this),
                model = $area.attr('data-model-class');
            var matches = _.compact(_.map(data.deltas, function(delta) {
              return model == delta.model_class ? delta : false
            }));

            var updates = {};
            _.each(matches, function(match) {
              /* Prefer the last seen update for this object. */
              updates[match.model_id] = match;
            });

            updates = _.values(updates);
            $.fluxx.log("triggering update.fluxx.area: " + updates.length + " ("+$area.attr('class')+" "+ $area.fluxxCard().attr('id')+")")
            if (updates.length) $area.trigger('update.fluxx.area', [updates]);
          });
        });
      });
    },
    fluxxCardUpdatesAvailable: function () {
      return this.data('updates_available') || 0;
    },
    updateFluxxCard: function (e, nUpdates, calling) {
      var $card = $(this);
      var updatesAvailable = $card.fluxxCardUpdatesAvailable() + nUpdates;
      if (updatesAvailable < 0) updatesAvailable = 0;
      this.data('updates_available', updatesAvailable);
      $.fluxx.log("update.fluxx.card triggered from [" + calling + ']', "TOTAL UPDATES AVAILABLE: " + $card.fluxxCardUpdatesAvailable() + '; ' + nUpdates + ' NEW');
      $('.updates .available', $card).text($card.fluxxCardUpdatesAvailable());
      if (updatesAvailable == 0) {
        $('.updates', $card).hide();
      } else {
        $('.updates', $card).show();
      }
      return this;
    },
    removeFluxxCard: function(options, onComplete) {
      var options = $.fluxx.util.options_with_callback({},options,onComplete);
      return this.each(function(){
        $(this)
          .fluxxCard()
          .bind({
            'unload.fluxx.card': _.callAll(
              options.callback,
              function(e){ $(e.target).remove(); $.my.cards = $('.card') }
            )
          })
          .trigger('close.fluxx.card')
          .trigger('unload.fluxx.card');
      });
    },
    resizeFluxxCard: function(options, onComplete) {
      var options = $.fluxx.util.options_with_callback({},options,onComplete);
      if (!$.my.hand) return this;

      $('.card-box', this.fluxxCard())
        .height(
          $.my.cards.height(
            $.my.hand.innerHeight() -
            $.fluxx.util.marginHeight($.my.cards)
          ).innerHeight()
        )
        .each(function(){
          var $box      = $(this),
              $cardBody = $('.card-body', $box);
          $box.width(
            _.addUp(
              $('.area', $box).not(':not(:visible)'),
              'outerWidth', true
            ) + 2
          );
          
          $('.area', $cardBody).height(
            $cardBody.height(
              $cardBody.parent().innerHeight() -
              _.addUp(
                $cardBody
                  .siblings()
                  .not(':not(:visible)')
                  .filter(function(){ return $(this).css('position') != 'absolute'; }),
                'outerHeight', true
              )
            ).innerHeight()
          ).each(function(){
            var $area     = $(this),
                $areaBody = $('.body', $area);
            $areaBody.height(
              $areaBody.parent().innerHeight() -
              _.addUp(
                $areaBody
                  .siblings()
                  .not(':not(:visible)')
                  .filter(function(){ return $(this).css('position') != 'absolute'; }),
                'outerHeight',
                true
              )
            );
          })
        });
      this.fluxxCard().width(
        _.addUp(
          this.fluxxCard()
            .children()
            .not(':not(:visible)')
            .filter(function(){ return $(this).css('position') != 'absolute'; }),
          'outerWidth', true
        ) +
        $('.drawer', this.fluxxCard()).outerWidth(true)
      )


      _.bind($.fn.resizeFluxxStage, $.my.stage)();

      return this;
    },
    
    /* Accessors */
    fluxxCard: function() {
      return this.data('card')
        || this.data('card', this.parents('.card:eq(0)').andSelf().first()).data('card');
    },
    fluxxCardAreas: function () {
      return $('.area', this.fluxxCard());
    },
    fluxxCardArea: function() {
      return this.data('area')
        || this.data('area', this.parents('.area:eq(0)').andSelf().first()).data('area');
    },
    fluxxCardAreaRequest: function () {
      var req = this.fluxxCardArea().data('history')[0];
      return {
        url:  req.url,
        data: req.data,
        type: req.type
      };
    },
    refreshCardArea: function(){
      return this.each(function(){
        var $area = $(this);
        $.fluxx.log(":::refreshCardArea:::", '  '+$area.fluxxCard().attr('id'), '    ' + $area.attr('class'));
        var req = $area.fluxxCardAreaRequest();
        $.extend(req, {area: $area});
        $area.fluxxCardLoadContent(req);
      });
    },
    fluxxCardAreaURL: function(options) {
      var options = $.fluxx.util.options_with_callback({without: []},options);
      var current = this.fluxxCardArea().data('history')[0];
      var withoutNames = _.pluck(options.without, 'name');
      $.fluxx.log('withoutNames', withoutNames);
      var params  = _.reject(current.data, function(elem) {
        return _.indexOf(withoutNames, elem.name) == -1 ? false : true;
      });
      /* Remove anything from current.data that's in options.without */
      return current.url + '?' + $.param(params);
    },
    fluxxCardAreaData: function() {
      return this.fluxxCardArea().data('history')[0].data;
    },
    fluxxCardListing: function() {
      return this.fluxxCard().data('listing');
    },
    fluxxCardDetail: function () {
      return this.fluxxCard().data('detail');
    },
    fluxxCardBox: function () {
      return this.fluxxCard().data('box');
    },
    fluxxCardBody: function () {
      return this.fluxxCard().data('body');
    },
    fluxxAreaSettings: function (options) {
      var options = $.fluxx.util.options_with_callback({settings: $()},options);
      if (options.settings.length < 1) return this;
      return this.each(function(){
        var $area = $(this);
        _.each(options.settings.children(), function (setting) {
          var key = $(setting).attr('name'),
              val = $(setting).text();
          $area.attr('data-' + key, val);
        })
      })
    },
    areaDetailTransform: function(){
      var $area  = $(this);

      var $forms = $('.body form', $area),
          $flows = $('.footer .workflow', $area);
      $forms.each(function(){
        var $form   = $(this),
            $submit = $(':submit:first', $form);
        /* XXX GENERATE FROM $.fluxx.card.ui.workflowButton() !!! */
        $('<a>').attr('href', $form.attr('action')).text($submit.val()||'Submit').bind('click', function(e){
          $.fluxx.util.itEndsWithMe(e);
          $form.submit();
        }).wrap('<li>').parent().appendTo($flows);
        $submit.hide();
      });
    },
    openListingFilters: function() {
      return this.each(function(){
        var $card    = $(this).fluxxCard(),
            $listing = $card.fluxxCardListing();
        var $filters = $($.fluxx.util.resultOf(
          $.fluxx.card.ui.area,
          {
            type: 'filters'
          }
        ));
        $card.fluxxCardLoadContent({
          area: $filters,
          url: $listing.attr('data-listing-filter'),
          header: '<span>' + 'Filter Listings' + '</span>',
          init: function (e) {
            $filters.appendTo($card.fluxxCardBody());
          }
        });
      });
    },
    closeListingFilters: function() {
      return this.each(function(){
        var $card = $(this).fluxxCard();
        $('.filters', $card).remove();
      });
    },
    openCardModal: function(options, onComplete) {
      var options = $.fluxx.util.options_with_callback({url: null, header: 'Modal', target: null},options, onComplete);
      if (!options.url || !options.target) return this;
      return this.each(function(){
        var $card = $(this).fluxxCard();
        var $modal = $($.fluxx.util.resultOf(
            $.fluxx.card.ui.area,
            {
              type: 'modal',
              arrow: 'left',
              closeButton: true,
            }
        )).data('target', options.target);
        $card.fluxxCardLoadContent(
          {
            area: $modal,
            url: options.url,
            header: '<span>' + options.header + '</span>',
            caller: options.target,
            init: function(e) {
              $modal.appendTo($card.fluxxCardBody());
              options.target.disableFluxxArea();
              var $arrow = $('.arrow', $modal);
              var targetPosition = options.target.position().top,
                  targetHeight = options.target.innerHeight(),
                  arrowHeight = $arrow.outerHeight(true);
              $arrow.css({
                top: parseInt(targetPosition - (arrowHeight/2 - targetHeight/2))
              });
              $modal.css({
                left: parseInt(options.target.offsetParent().position().left + options.target.outerWidth(true) + ($arrow.outerWidth(true))),
              });
            }
          },
          function(e) {
            $card.resizeFluxxCard();
          }
        );
      });
    },
    closeCardModal: function(options, onComplete) {
      var options = $.fluxx.util.options_with_callback({url: null, header: 'Modal', target: null},options, onComplete);
      return this.each(function(){
        var $modal = $('.modal', $(this).fluxxCard());
        $modal.data('target').enableFluxxArea();
        $modal.remove();
      });
    },
    disableFluxxArea: function () {
      return this.each(function(){
        $(this).fluxxCardArea().addClass('disabled');
      });
    },
    enableFluxxArea: function () {
      return this.each(function(){
        $(this).fluxxCardArea().removeClass('disabled');
      });
    },
    fluxxAreaUpdate: function(e, updates) {
      var $area     = $(e.target),
          seen      = $area.data('updates_seen') || [],
          areaType  = $area.attr('data-type'),
          updates   = _.reject(updates, function(m) {return _.include(seen, m.model_id)}),
          nextEvent = areaType + '_update.fluxx.area';
    
      $area.data('updates_seen', _.flatten([seen, _.pluck(updates, 'model_id')]));
      $area.data('latest_updates', _.pluck(updates, 'model_id'));
      $area.trigger(nextEvent, [updates]);
    },
    fluxxListingUpdate: function(e, updates) {
      var $area   = $(e.target),
          filters = $area.fluxxCardAreaData(),
          updates = _.select(updates, function(update){
                        return _.isFilterMatch(filters, update);
                    });
      if (!updates.length) return;
      
      var model_ids = _.pluck(updates, 'model_id');
      $.fluxx.log('--- $area and $card length ---', $area.length, $area.fluxxCard().length, '---');
      $area.fluxxCard().trigger('update.fluxx.card', [_.size(model_ids), 'fluxxListingUpdate']);
    },
    getFluxxListingUpdate: function (e) {
      var $area = $(this);
      var updates = $area.data('latest_updates');
      if (_.isEmpty(updates)) return;
      var req  = $area.fluxxCardAreaRequest();
      $.extend(
        true,
        req,
        {
          data: {
            id: updates
          },
          success: function (data, status, xhr) {
            var $document = $(data);
            var $entries  = $('.entry', $document);
            var $removals = $();
            var IDs = _.intersect(
              _.map($entries, function (e) { return $(e).attr('data-model-id') }),
              _.map($('.entry', $area), function (e) { return $(e).attr('data-model-id') })
            );

            _.each(
              IDs,
              function(id) {$removals = $removals.add($('.entry[data-model-id='+id+']', $area))}
            );
            $removals.remove();
            $entries.addClass('latest').prependTo($('.list', $area));
            $area.fluxxCard().trigger('update.fluxx.card', [-1 * $entries.length, 'getFluxxListingUpdate'])
          }
        }
      );
      $.ajax(req)
    },
    
    /* Data Loaders */
    fluxxCardLoadContent: function (options, onComplete) {
      var defaults = {
        area: undefined,
        type: 'GET',
        url: null,
        data: {},
        caller: $(),
        /* defaults for sections */
        header: '',
        body: '',
        footer: '',
        /* events */
        update: $.noop,
        init: $.noop,
        lifetimeComplete: function(e) {
          var $area = $(this);
          var isSuccess = options.caller.attr('data-is-success'),
              onSuccess = options.caller.attr('data-on-success');

          if (onSuccess&& isSuccess && $(isSuccess, $area).length) {
            _.each(onSuccess.split(/,/), function(action){
              var func = $.fluxx.card.loadingActions[action] || $.noop;
              (_.bind(func, $area))();
            });
          }
        }
      };
      var options = $.fluxx.util.options_with_callback(defaults,options,onComplete);
      options.area
        .unbind('init.fluxx.area')
        .bind('init.fluxx.area', _.callAll(
          $.fluxx.util.itEndsHere,
          options.init
        )).trigger('init.fluxx.area');

      options.area.bind('lifetimeComplete.fluxx.area', _.bind(options.lifetimeComplete, options.area));

      options.area
        .unbind('complete.fluxx.area')
        .bind('complete.fluxx.area', _.callAll(
          $.fluxx.util.itEndsWithMe,
          _.bind($.fn.areaDetailTransform, options.area),
          _.bind($.fn.resizeFluxxCard, options.area.fluxxCard()),
          options.callback
        ));
      options.area
        .unbind('update.fluxx.area')
        .bind('update.fluxx.area', _.callAll(
          $.fluxx.util.itEndsHere,
          _.bind($.fn.fluxxAreaUpdate, options.area),
          options.update
        ));
      if (!options.url) {
        options.area.hide().trigger('complete.fluxx.area');
        return this;
      }
      if (!options.area.data('history')) {
        options.area.data('history', [options]);
      } else {
        options.area.data('history').unshift(options);
      }

      $.ajax({
        url: options.url,
        type: options.type,
        data: options.data,
        success: function (data, status, xhr) {
          if (xhr.status == 201) {
            var opts = $.extend(true, options, {type: 'GET', url: xhr.getResponseHeader('Location')});
            $.fluxx.log(opts);
            options.area.fluxxCardLoadContent(opts);
          } else {
            options.area.show();
            var $document = $('<div/>').html(data);
            $('.header', options.area).html(($('#card-header', $document).html() || options.header).trim());
            $('.body',   options.area).html(($('#card-body',   $document).html() || options.body).trim());
            $('.footer', options.area).html(($('#card-footer', $document).html() || options.footer).trim());
            $('.drawer', options.area.fluxxCard()).html(($('#card-drawer', $document).html() || '').trim());
            $('.header,.body,.footer', options.area).add('.drawer', options.area.fluxxCard()).removeClass('empty').filter(':empty').addClass('empty');
            options.area
              .fluxxAreaSettings({settings: $('#card-settings', $document)})
              .trigger('complete.fluxx.area')
              .trigger('lifetimeComplete.fluxx.area');
          }
        },
        error: function(xhr, status, error) {
          options.area.show();
          var $document = $('<div/>').html(xhr.responseText);
          $('.header', options.area).html('');
          $('.body', options.area).html($document);
          $('.footer', options.area).html('');
          $('.drawer', options.area.fluxxCard()).html(($('#card-drawer', $document).html() || '').trim());
          $('.header,.body,.footer', options.area).add('.drawer', options.area.fluxxCard()).removeClass('empty').filter(':empty').addClass('empty');
          options.area
            .trigger('complete.fluxx.area')
            .trigger('lifetimeComplete.fluxx.area');
        },
        beforeSend: function() { $('.loading-indicator', options.area.fluxxCard()).addClass('loading') },
        complete: function() { $('.loading-indicator', options.area.fluxxCard()).removeClass('loading') }
      });
      
      return this;
    },
    
    fluxxCardLoadListing: function (options, onComplete) {
      var options = $.fluxx.util.options_with_callback({area: this.fluxxCardListing()},options,onComplete);
      return this.fluxxCardLoadContent(options);
    },
    
    fluxxCardLoadDetail: function(options, onComplete) {
      var options = $.fluxx.util.options_with_callback({area: this.fluxxCardDetail()},options,onComplete);
      return this.fluxxCardLoadContent(options);
    }
  });
  
  $.extend(true, {
    fluxx: {
      card: {
        defaults: {
          title: 'New Card',
          load: $.noop,
          close: $.noop,
          unload: $.noop,
          update: $.noop,
          listing: {
            url: null
          },
          detail: {
            url: null
          }
        },
        attrs: {
          'class': 'card',
          id: function(){return _.uniqueId('fluxx-card-')}
        },
        ui: function(options) {
          return $('<li>')
            .attr($.fluxx.card.attrs)
            .html($.fluxx.util.resultOf([
              '<div class="card-box">',
                '<div class="card-header">',
                  $.fluxx.util.resultOf($.fluxx.card.ui.toolbar,  options),
                  $.fluxx.util.resultOf($.fluxx.card.ui.titlebar, options),
                '</div>',
                '<div class="card-body">',
                  $.fluxx.util.resultOf($.fluxx.card.ui.area, $.extend(options,{type: 'listing'})),
                  $.fluxx.util.resultOf($.fluxx.card.ui.area, $.extend(options,{type: 'detail', drawer: true})),
                '</div>',
                '<div class="card-footer">',
                '</div>',
              '</div>',
              '<div class="drawer"></div>',
            ]));
        },
        loadingActions: {
          close: function(){
            this.closeCardModal();
          },
          refreshCaller: function(){
            if (! this.data('target')) return;
            this.data('target').refreshCardArea();
          }
        }
      }
    }
  });
  $.fluxx.card.ui.toolbar = [
    '<div class="toolbar">',
      '<span class="loading-indicator"></span>',
      '<a class="updates" href="#">',
        '<span class="available">0</span>',
        ' update<span class="non-one">s</span>',
        ' available',
      '</a>',
      ' ',
      '<ul class="buttons controls">',
        '<li class="first"><a href="#" class="close-detail">&lArr;</a></li>',
        '<li><a href="#" class="minimize-card">&#9604;</a></li>',
        '<li class="last"><a href="#" class="close-card">&times;</a></li>',
      '</ul>',
    '</div>'
  ].join('');
  $.fluxx.card.ui.titlebar = function(options) {
    return [
      '<div class="titlebar">',
        '<span class="title">',
          options.title,
        '</span>',
        '<ul class="content-actions">',
          '<li><a href="#" class="refresh-card"><img src="',$.fluxx.util.iconImage('arrow_refresh'),'" /></a></li>',
          '<li><a href="#" class="open-filters"><img src="',$.fluxx.util.iconImage('cog_edit'),'" /></a></li>',
        '</ul>',
      '</div>'
    ];
  };
  $.fluxx.card.ui.contentAction = function(options) {
    return [
      /* Make a list entry with a link and an image tag */
    ];
  };
  $.fluxx.card.ui.area = function(options) {
    var types = _.flatten($.merge($.makeArray(options.type), ['area']));
    return [
      '<div class="', types.join(' '), '" data-type="', options.type ,'" ', (options.drawer ? ' data-has-drawer="1" ' : null),
 ,'>',
        (options.closeButton ? ['<ul class="controls"><li><a href="#" class="close-modal">&times;</a></li></ul>'] : null),
        (options.arrow ? ['<div class="arrow ', options.arrow, '"></div>'] : null),
        '<div class="header"></div>',
        '<div class="body"></div>',
        '<div class="footer"></div>',
      '</div>'
    ];
  };
  
  $(window).resize(function(e){
    $.my.cards.resizeFluxxCard();
  }).resize();
})(jQuery);
(function($){
  $.fn.extend({
    addFluxxDock: function(options, onComplete) {
      var options = $.fluxx.util.options_with_callback($.fluxx.dock.defaults,options,onComplete);
      return this.each(function(){
        $.my.dock = $.fluxx.dock.ui.call($.my.footer, options)
          .appendTo($.my.footer);
        $.my.viewport = $('#viewport');
        $.my.iconlist = $('#iconlist');
        $.my.dock
          .bind({
            'complete.fluxx.dock': _.callAll(options.callback, $.fluxx.util.itEndsWithMe)
          })
          .trigger('complete.fluxx.dock');

        $('.icon', '.dock').live('mouseover mouseout', function(e) {
          var $icon  = $(e.currentTarget);
          var $popup = $('.popup', $icon);
          if (event.type == 'mouseover') {
            $popup.show();
          } else {
            $popup.hide();
          }
        });
      });
    },
    
    addViewPortIcon: function(options) {
      var options = $.fluxx.util.options_with_callback({}, options);
      return this.each(function(){
        if (options.card.data('icon')) return;
        var $icon = $.fluxx.dock.ui.icon.call($.my.dock, {
          label: 'Card',
          url: '#'+options.card.attr('id'),
          popup: 'Hello'
        }).updateIconBadge().appendTo($.my.iconlist);
        options.card.data('icon', $icon);
        $icon.data('card', options.card);
      });
    },
    updateIconBadge: function (options) {
      var options = $.fluxx.util.options_with_callback({badge: ''}, options);
      return this.each(function(){
        var $icon  = $(this),
            $badge = $('.badge', $icon);
        $badge.text(options.badge);
        $badge.is(':empty') || $badge.text() == 0 ? $badge.hide() : $badge.show();
      });
    },
    removeViewPortIcon: function(options) {
      var options = $.fluxx.util.options_with_callback({}, options);
      return this.each(function(){
        if (!options.card.data('icon')) return;
        options.card.data('icon').remove();
        options.card.data('icon', null);
      });
    }

  });
  $.extend(true, {
    fluxx: {
      dock: {
        defaults: {
        },
        attrs: {
          'class': 'dock'
        },
        ui: function(options) {
          return $('<div>')
            .attr($.fluxx.dock.attrs)
            .html($.fluxx.util.resultOf([
              $.fluxx.dock.ui.viewport(options),
              $.fluxx.dock.ui.quicklinks(options)
            ]));
        }
      }
    }
  });
  $.fluxx.dock.ui.quicklinks = function (options) {
    return $.fluxx.util.resultOf([
      '<div id="quicklinks">',
          _.map($.fluxx.config.dock.quicklinks, function(qlset) {
            return [
              '<ol class="qllist">',
                _.map(qlset, function(ql) {
                  return $.fluxx.dock.ui.icon.call($.my.dock, ql);
                }),
              '</ol>'
            ];
          }),
      '</div>'
    ]);
  };
  $.fluxx.dock.ui.viewport = function (options) {
    return $.fluxx.util.resultOf([
      '<div id="viewport">',
        '<ol id="iconlist"></ol>',
      '</div>'
    ]);
  };
  $.fluxx.dock.ui.icon = function(options) {
    var options = $.fluxx.util.options_with_callback({
      label: '',
      badge: '',
      url:   '',
      popup: null,
      openOn: ['hover'],
      className: null,
      type: null
    }, options);
    
    var popup = (
        !_.isNull(options.popup)
      ? [
          '<div class="popup"><ul>',
            _.map(
              _.flatten($.makeArray(options.popup)),
              function (line) {return ['<li>', line, '</li>'];}
            ),
          '</ul></div>'
        ]
      : ''
    );
    
    return $($.fluxx.util.resultOf([
      '<li class="icon ', options.type, '">',
        '<a class="link ', options.className, '" href="', options.url, '">',
          '<span class="label">', options.label, '</span>',
          '<span class="badge">', options.badge, '</span>',
        '</a>',
        popup,
      '</li>'
    ]));
  };
  
  $(function($){
    $('#stage').live('complete.fluxx.stage', function(e) {
      $.my.footer.addFluxxDock(function(){
        $('.card')
          .each(function(){ $.my.dock.addViewPortIcon({card: $(this)}); })
          .live('load.fluxx.card', function(e){
            $.fluxx.util.itEndsWithMe(e);
            $.my.dock.addViewPortIcon({card: $(this)});
          })
         .live('close.fluxx.card', function(e){
            $.fluxx.util.itEndsWithMe(e);
            $.my.dock.removeViewPortIcon({card: $(this)});
          })
          .live('update.fluxx.card', function (e, nUpdate) {
            if (!_.isEmpty(nUpdate) || !$(e.target).data('icon')) return;
            var $card = $(e.target);
            $card.data('icon').updateIconBadge({badge: $card.fluxxCardUpdatesAvailable()});
          });
      });
    });
  });
})(jQuery);