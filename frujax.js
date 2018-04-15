;(function (window, document, $, undefined) {
    'use strict';

    var defaults = {
        action: 'fill',
        ajaxOptions: {
            dataType: 'html',
        },
        autoload: false,
        history: false,
        interceptRedirect: true,
        on: function ($element) {
            if ($element.is('form')) {
                return 'submit';
            }

            if ($element.is('a, :button')) {
                return 'click';
            }

            return null;
        },
        preventDefault: true,
        redirectMode: 'follow',
        serialMode: 'async',
        target: null,
        url: function ($element) {
            if ($element.is('a')) {
                return $element.prop('href');
            }

            return null;
        },
    };

    $.extend({
        frujaxDefaults: function (options) {
            return $.extend(true, defaults, options);
        }
    });

    function Frujax(element, options) {
        this.$element = $(element);
        this.opts = $.extend(true, {}, defaults, options);
        this.jqXHR = null;

        if ('function' === typeof this.opts.on) {
            this.opts.on = this.opts.on(this.$element);
        }

        if ('function' === typeof this.opts.url) {
            this.opts.url = this.opts.url(this.$element);
        }

        this.init();
    }

    $.extend(Frujax.prototype, {
        options: function (options) {
            return $.extend(true, this.opts, options);
        },
        init: function () {
            this._bind();

            if (this.opts.autoload) {
                this.request();
            }
        },
        destroy: function () {
            this.abort();
            this._unbind();
        },
        refresh: function () {
            this.destroy();
            this.init();
        },
        request: function (options) {
            var base = this,
                serialMode = base.opts.serialMode;

            if (null !== base.jqXHR && 'async' !== serialMode && 4 !== base.jqXHR.readyState) {
                if ('force' === serialMode) {
                    base.jqXHR.abort();
                } else if ('lock' === serialMode) {
                    return;
                }
            }

            var $element = base.$element,
                ajaxOptions = base._resolveAjaxOptions(options);

            $element.trigger('before.frujax', ajaxOptions);

            base._initJqXHR(ajaxOptions);

            base.jqXHR
                .done(function (data, textStatus, jqXHR) {
                    var context = base._createContext(ajaxOptions, jqXHR, textStatus, null, data);

                    $element.trigger('always.frujax', context);

                    if (context.redirectUrl) {
                        $element.trigger('redirect.frujax', context);

                        base._processRedirect(context.redirectUrl, ajaxOptions);
                    } else {
                        $element.trigger('success.frujax', context);

                        base._applyAction(context.$target, context.$content);

                        $element.trigger('acted.frujax', context);

                        if (base.opts.history) {
                            base._pushHistoryState(context.title, context.url);
                        }
                    }
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    var context = base._createContext(ajaxOptions, jqXHR, textStatus, errorThrown);

                    $element.trigger('always.frujax', context);
                    $element.trigger('fail.frujax', context);
                });
        },
        abort: function () {
            if (null !== this.jqXHR && 4 !== this.jqXHR.readyState) {
                this.jqXHR.abort();
            }
        },
        _bind: function () {
            if (null === this.opts.on) {
                return;
            }

            var base = this,
                events = (base.opts.on + ' ').replace(/(\w) /g, '$1.frujax.internal ');

            base.$element.on(events, function (event) {
                if (base.opts.preventDefault) {
                    event.preventDefault();
                }

                base.request();
            });
        },
        _unbind: function () {
            this.$element.off('.frujax.internal');
        },
        _resolveAjaxOptions: function (options) {
            var ajaxOptions = $.extend(
                true,
                {url: this.opts.url},
                this.opts.ajaxOptions,
                options
            );

            ajaxOptions.headers = $.extend({}, ajaxOptions.headers, {
                'Frujax': 1,
                'Frujax-Intercept-Redirect': this.opts.interceptRedirect ? 1 : 0
            });

            return ajaxOptions;
        },
        _initJqXHR: function (options) {
            if (this.$element.is('form')) {
                if ('function' === typeof $.fn.ajaxSubmit) {
                    this.jqXHR = this.$element.ajaxSubmit(options).data('jqxhr');

                    return;
                }

                console.warn('jQuery Form Plugin is required to submit forms correctly. https://github.com/jquery-form/form');
            }

            this.jqXHR = $.ajax(options);
        },
        _createContext: function (ajaxOptions, jqXHR, textStatus, errorThrown, data) {
            return {
                $content: data ? $(data) : null,
                $target: null === this.opts.target ? this.$element : $(this.opts.target),
                ajaxOptions: ajaxOptions,
                errorThrown: errorThrown,
                jqXHR: jqXHR,
                redirectUrl: jqXHR.getResponseHeader('Frujax-Redirect-Url') || null,
                textStatus: textStatus,
                title: jqXHR.getResponseHeader('Frujax-Title') || '',
                url: jqXHR.getResponseHeader('Frujax-Url') || ajaxOptions.url || null,
                getHeader: function (name) {
                    return jqXHR.getResponseHeader(name);
                },
            };
        },
        _processRedirect: function (redirectUrl, ajaxOptions) {
            var redirectMode = this.opts.redirectMode;

            if ('follow' === redirectMode) {
                this.request($.extend({}, ajaxOptions, {url: redirectUrl}));
            } else if ('assign' === redirectMode) {
                document.location.assign(redirectUrl);
            } else if ('replace' === redirectMode) {
                document.location.replace(redirectUrl);
            }
        },
        _applyAction: function ($target, $content) {
            var action = this.opts.action;

            if ('function' === typeof action) {
                action($target, $content);
            } else if ('fill' === action) {
                $target.html($content);
            } else if ('replace' === action) {
                $target.replaceWith($content);
            } else if ('prepend' === action) {
                $target.prepend($content);
            } else if ('append' === action) {
                $target.append($content);
            } else if ('after' === action) {
                $target.after($content);
            } else if ('before' === action) {
                $target.before($content);
            }
        },
        _pushHistoryState: function (title, url) {
            window.history.pushState(null, title, url);
        },
    });

    $.fn.frujax = function (options) {
        var args = arguments;

        if (undefined === options || 'object' === typeof options) {
            return this.each(function () {
                if (!($.data(this, 'frujaxInstance') instanceof Frujax)) {
                    $.data(this, 'frujaxInstance', new Frujax(this, options));
                }
            });
        } else if ('string' === typeof options && '_' !== options[0] && 'init' !== options) {
            var returns;

            this.each(function () {
                var instance = $.data(this, 'frujaxInstance');

                if (instance instanceof Frujax && 'function' === typeof instance[options]) {
                    returns = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
                }

                if ('destroy' === options) {
                    $.data(this, 'frujaxInstance', null);
                }
            });

            return undefined !== returns ? returns : this;
        }
    };

    var initFrujax = function (scope) {
        $(scope)
            .find('[data-frujax]')
            .addBack('[data-frujax]')
            .each(function () {
                $(this).frujax($(this).data('frujax'));
            });
    };

    $(document)
        .ready(function () {
            initFrujax(document);
        })
        .on('acted.frujax', function (event, context) {
            initFrujax(context.$content);
        });
})(window, document, jQuery);
