;(function (window, document, $, undefined) {
    'use strict';

    var defaults = {
        action: 'fill',
        ajaxOptions: {},
        autoload: false,
        data: undefined,
        filter: null,
        headers: undefined,
        history: false,
        interceptRedirect: true,
        method: undefined,
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
        source: function ($element) {
            return $element;
        },
        target: null,
        timeout: undefined,
        url: function ($element) {
            if ($element.is('a')) {
                return $element.prop('href');
            }

            return undefined;
        },
    };

    $.extend({
        frujaxDefaults: function (options) {
            if (undefined !== options) {
                $.extend(true, defaults, options);
            }

            return defaults;
        }
    });

    function Frujax(element, options) {
        this._$element = $(element);
        this._options = $.extend(true, {}, defaults, options);
        this._jqXHRs = [];

        var base = this;

        $.each(this._options, function (key, value) {
            if ('function' === typeof value) {
                base._options[key] = value(base._$element);
            }
        });

        base.init();
    }

    $.extend(Frujax.prototype, {
        abort: function () {
            for (var i = 0; i < this._jqXHRs.length; i++) {
                if (null !== this._jqXHRs[i]) {
                    this._jqXHRs[i].abort();
                }
            }
        },
        destroy: function () {
            this.abort();
            this._unbind();
        },
        init: function () {
            this._bind();

            if (this._options.autoload) {
                this.request();
            }
        },
        options: function (options) {
            if (undefined !== options) {
                $.extend(true, this._options, options);
            }

            return this._options;
        },
        refresh: function () {
            this.abort();
            this._unbind();
            this.init();
        },
        request: function (requestAjaxOptions, ignoreSource) {
            var base = this,
                serialMode = base._options.serialMode;

            if ('force' === serialMode) {
                base.abort();
            } else if ('lock' === serialMode && base._hasActiveJqXHRs()) {
                return;
            }

            var $element = base._$element,
                ajaxOptions = base._resolveAjaxOptions(requestAjaxOptions || {}),
                index = base._jqXHRs.length;

            $element.trigger('before.frujax', ajaxOptions);

            base._jqXHRs[index] = base._createJqXHR(ajaxOptions, ignoreSource)
                .done(function (data, textStatus, jqXHR) {
                    base._jqXHRs[index] = null;

                    var context = base._createContext(ajaxOptions, jqXHR, textStatus, null, data);

                    $element.trigger('always.frujax', context);

                    if (context.redirectLocation) {
                        if (base._options.interceptRedirect) {
                            $element.trigger('redirect.frujax', context);
                            base._processRedirect(context);
                        } else {
                            console.info('Ignored Frujax-Redirect-Location response header, because interceptRedirect is set to false.');
                        }
                    } else {
                        $element.trigger('success.frujax', context);
                        base._applyAction(context.$target, context.$content);

                        if (base._options.history) {
                            base._pushHistoryState(context.title, context.url);
                        }
                    }
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    base._jqXHRs[index] = null;

                    var context = base._createContext(ajaxOptions, jqXHR, textStatus, errorThrown);

                    $element.trigger('always.frujax', context);
                    $element.trigger('fail.frujax', context);
                });
        },
        _applyAction: function ($target, $content) {
            var action = this._options.action;

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
        _bind: function () {
            if (null === this._options.on) {
                return;
            }

            var base = this,
                events = (base._options.on + ' ').replace(/(\w) /g, '$1.frujax.internal ');

            base._$element.on(events, function (event) {
                if (base._options.preventDefault) {
                    event.preventDefault();
                }

                base.request();
            });
        },
        _createContext: function (ajaxOptions, jqXHR, textStatus, errorThrown, data) {
            var redirectStatusCode = jqXHR.getResponseHeader('Frujax-Redirect-Status-Code'),
                $content = null;

            if (data) {
                $content = $(data);

                if (null !== this._options.filter) {
                    $content = $(this._options.filter, $content);
                }
            }

            return {
                $content: $content,
                $target: null === this._options.target ? this._$element : $(this._options.target),
                ajaxOptions: ajaxOptions,
                errorThrown: errorThrown,
                jqXHR: jqXHR,
                redirectLocation: jqXHR.getResponseHeader('Frujax-Redirect-Location') || null,
                redirectStatusCode: redirectStatusCode ? parseInt(redirectStatusCode) : null,
                textStatus: textStatus,
                title: jqXHR.getResponseHeader('Frujax-Title') || '',
                url: jqXHR.getResponseHeader('Frujax-Url') || ajaxOptions.url || null,
                getHeader: function (name) {
                    return jqXHR.getResponseHeader(name);
                },
            };
        },
        _createJqXHR: function (ajaxOptions, ignoreSource) {
            if (ignoreSource || !this._options.source) {
                return $.ajax(ajaxOptions);
            }

            var $source = $(this._options.source);

            if ($source.is('form')) {
                if (this._jQueryFormPluginExists()) {
                    return $source.ajaxSubmit(ajaxOptions).data('jqxhr');
                }

                console.warn('jQuery Form Plugin is required to submit forms correctly. https://github.com/jquery-form/form');
            }

            return $.ajax($.extend(true, {data: $source.serializeArray()}, ajaxOptions));
        },
        _hasActiveJqXHRs: function () {
            for (var i = 0; i < this._jqXHRs.length; i++) {
                if (null !== this._jqXHRs[i]) {
                    return true;
                }
            }

            return false;
        },
        _jQueryFormPluginExists: function () {
            return 'function' === typeof $.fn.ajaxSubmit;
        },
        _processRedirect: function (context) {
            var redirectMode = this._options.redirectMode;

            if ('follow' === redirectMode) {
                var options = $.extend({}, context.ajaxOptions, {url: context.redirectLocation}),
                    ignoreSource;

                if (307 === context.redirectStatusCode) {
                    ignoreSource = false;
                } else {
                    ignoreSource = true;
                    $.extend(options, {
                        type: 'GET',
                        headers: {},
                        data: {},
                    });
                }

                this.request(options, ignoreSource);
            } else if ('assign' === redirectMode) {
                document.location.assign(context.redirectLocation);
            } else if ('replace' === redirectMode) {
                document.location.replace(context.redirectLocation);
            }
        },
        _pushHistoryState: function (title, url) {
            window.history.pushState(null, title, url);
        },
        _resolveAjaxOptions: function (requestAjaxOptions) {
            return $.extend(
                true,
                {
                    data: this._options.data,
                    headers: this._options.headers,
                    timeout: this._options.timeout,
                    type: this._options.method,
                    url: this._options.url,
                },
                this._options.ajaxOptions,
                requestAjaxOptions,
                {
                    headers: {
                        'Frujax': 1,
                        'Frujax-Intercept-Redirect': this._options.interceptRedirect ? 1 : undefined
                    }
                }
            );
        },
        _unbind: function () {
            this._$element.off('.frujax.internal');
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
        .on('success.frujax', function (event, context) {
            initFrujax(context.$content);
        });
})(window, document, jQuery);
