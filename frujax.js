;(function (window, document, $, undefined) {
    'use strict';

    /**
     * Constants
     */

    var _SELF = '_self';
    var NAMED_BUTTON = ':submit[name!=""][name]';
    var INTERNAL_EVENT = '._frujax_internal';

    /**
     * Serial autoload
     */

    var autoloadQueue = [];

    var autoloadBlocked = false;

    var autoloadNext = function () {
        if (autoloadBlocked || 0 === autoloadQueue.length) {
            return;
        }

        autoloadBlocked = true;
        autoloadQueue
            .shift()
            .one('finished.frujax', function () {
                autoloadBlocked = false;
                autoloadNext();
            })
            .frujax('request');
    };

    /**
     * [data-frujax] elements initialization
     */

    var initDataFrujaxElements = function (scope) {
        $(scope)
            .find('[data-frujax]')
            .addBack('[data-frujax]')
            .each(function () {
                $(this).frujax($(this).data('frujax'));
            });
    };

    $(document).ready(function () {
        initDataFrujaxElements(document);
    });

    /**
     * Plugin definition
     */

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

    /**
     * Plugin globals
     */

    $.fn.frujax.actions = {
        fill: function ($target, $content) {
            $target.html($content);
        },
        replace: function ($target, $content) {
            setTimeout(function () {
                $target.replaceWith($content);
            }, 0);
        },
        prepend: function ($target, $content) {
            $target.prepend($content);
        },
        append: function ($target, $content) {
            $target.append($content);
        },
        after: function ($target, $content) {
            $target.after($content);
        },
        before: function ($target, $content) {
            $target.before($content);
        },
    };

    $.fn.frujax.defaults = {
        action: 'fill',
        autoload: false,
        concurrent: null,
        data: {},
        filter: null,
        headers: {},
        history: false,
        method: null,
        on: null,
        preventDefault: true,
        redirect: null,
        source: _SELF,
        target: _SELF,
        timeout: 0,
        url: null,
    };

    $.fn.frujax.onGuessers = [
        function () {
            if (this.is('form')) {
                return 'submit';
            }

            if (this.is('a, :button')) {
                return 'click';
            }

            if (this.is(':input')) {
                return 'change';
            }
        },
    ];

    $.fn.frujax.serialAutoload = true;

    /**
     * Library
     */

    var Frujax = function (element, options) {
        this._$element = $(element);
        this._options = {};
        this._xhrs = [];
        this._requests = [];

        this.options($.fn.frujax.defaults);
        this.options(options);
        this.init();
    };

    $.extend(Frujax.prototype, {
        abort: function () {
            this._requests = [];
            this._xhrs.slice(0).forEach(function (xhr) {
                xhr.abort();
            });
        },
        destroy: function () {
            this.abort();
            this._unbind();
        },
        init: function () {
            this._bind();

            if (this._options.autoload) {
                if ($.fn.frujax.serialAutoload) {
                    autoloadQueue.push(this._$element);
                    setTimeout(autoloadNext, 0);
                } else {
                    this.request();
                }
            }
        },
        options: function (options, deep) {
            var $element = this._$element;

            if ('object' === typeof options) {
                var newOptions = $.extend(true, {}, options);

                $.each(newOptions, function (key, value) {
                    if (_SELF === value) {
                        value = $element;
                    }

                    newOptions[key] = value;
                });

                if (false === deep) {
                    $.extend(this._options, newOptions);
                } else {
                    $.extend(true, this._options, newOptions);
                }
            }

            return this._options;
        },
        refresh: function () {
            this.destroy();
            this.init();
        },
        request: function (request) {
            request = request || {};

            var concurrent = this._options.concurrent;

            if (this._xhrs.length > 0) {
                if ('propel' === concurrent) {
                    this.abort();
                } else if ('ignore' === concurrent) {
                    return;
                }
            }

            var $element = this._$element,
                $source = $(this._options.source),
                sourceMethod,
                sourceUrl;

            if ($source.is('form')) {
                sourceMethod = $source.prop('method');
                sourceUrl = $source.prop('action');
            }

            request.method = (
                request.method ||
                this._options.method ||
                sourceMethod ||
                'GET'
            ).toUpperCase();

            request.url = [
                request.url,
                this._options.url,
                sourceUrl,
                window.location.href || ''
            ].find(function (url) {
                return 'string' === typeof url;
            });

            request.headers = $.extend(true, {},
                this._options.headers,
                request.headers || {},
                {
                    'Frujax': 1,
                    'Frujax-Intercept-Redirect': null === this._options.redirect ? undefined : 1,
                    'X-Requested-With': 'XMLHttpRequest',
                }
            );

            request.data = $.extend(true, {},
                this._options.data,
                request.data || {}
            );

            $element.trigger('before.frujax', [request]);

            if ('GET' === request.method) {
                var queryString = this._createQueryString($source, request.data);

                if (queryString) {
                    request.url += (request.url.indexOf('?') < 0 ? '?' : '') + queryString;
                }
            } else {
                request.body = this._createFormData($source, request.data);
            }

            this._requests.push(request);
            this._requestNext();
        },
        _applyAction: function ($target, $content) {
            var action = this._options.action;

            if ('string' === typeof action && action in $.fn.frujax.actions) {
                action = $.fn.frujax.actions[action];
            } else if ('function' !== typeof action) {
                return;
            }

            action.call(this._$element, $target, $content);
        },
        _bind: function () {
            var base = this,
                $element = base._$element,
                on = this._getOn();

            if (!on) {
                return;
            }

            on = (on + ' ').replace(/\b /g, INTERNAL_EVENT + ' ');

            $element.on(on, function (event) {
                if (base._options.preventDefault) {
                    event.preventDefault();
                }

                base.request();
            });

            $element
                .find(NAMED_BUTTON)
                .addBack(NAMED_BUTTON)
                .on('click' + INTERNAL_EVENT, function () {
                    var $button = $(this);

                    $element.one('before.frujax' + INTERNAL_EVENT, function (event, request) {
                        request.data[$button.prop('name')] = $button.prop('value');
                    });
                });
        },
        _createFormData: function ($source, data) {
            var formData;

            if ($source.is('form')) {
                formData = new FormData($source.get(0));
            } else {
                formData = new FormData();
                $source.serializeArray().forEach(function (element) {
                    formData.append(element.name, element.value);
                });
                $source
                    .find('input:file')
                    .addBack('input:file')
                    .each(function (index, element) {
                        formData.append(element.name, element.files[0]);
                    });
            }

            this._formDataAppendObject(formData, data);

            return formData;
        },
        _createQueryString: function ($source, data) {
            var sourceString = $source.serialize(),
                dataString = $.param(data);

            return sourceString + (sourceString && dataString ? '&' : '') + dataString;
        },
        _createResponse: function (xhr, status) {
            var redirectStatusCode = xhr.getResponseHeader('Frujax-Redirect-Status-Code'),
                $content = $(xhr.responseText);

            if (this._options.filter) {
                $content = $(this._options.filter, $content);
            }

            return {
                xhr: xhr,
                status: status,
                $content: $content,
                $target: $(this._options.target),
                redirectLocation: xhr.getResponseHeader('Frujax-Redirect-Location') || null,
                redirectStatusCode: redirectStatusCode ? parseInt(redirectStatusCode) : null,
                title: xhr.getResponseHeader('Frujax-Title') || '',
                url: xhr.getResponseHeader('Frujax-Url') || null,
            };
        },
        _formDataAppendObject: function (FormData, data, name) {
            var base = this;

            if ('object' === typeof data) {
                $.each(data, function (index, value) {
                    if (name) {
                        base._formDataAppendObject(FormData, value, name + '[' + index + ']');
                    } else {
                        base._formDataAppendObject(FormData, value, index);
                    }
                });
            } else {
                FormData.append(name, data);
            }
        },
        _getOn: function () {
            if (this._options.on) {
                return this._options.on;
            }

            var on;

            for (var i = 0; i < $.fn.frujax.onGuessers.length; i++) {
                on = $.fn.frujax.onGuessers[i].call(this._$element);

                if (on) {
                    return on;
                }
            }

            return null;
        },
        _handleRedirect: function (request, redirectStatusCode, redirectLocation) {
            var redirect = this._options.redirect;

            if ('request' === redirect) {
                if (301 === redirectStatusCode ||
                    302 === redirectStatusCode ||
                    303 === redirectStatusCode
                ) {
                    request.method = 'GET';
                    request.url = redirectLocation;
                    request.body = null;
                    this._send(request);
                } else if (
                    307 === redirectStatusCode ||
                    308 === redirectStatusCode
                ) {
                    request.url = redirectLocation;
                    this._requests.unshift(request);
                    this._requestNext();
                }
            } else if ('assign' === redirect) {
                document.location.assign(redirectLocation);
            } else if ('replace' === redirect) {
                document.location.replace(redirectLocation);
            }
        },
        _pushHistoryState: function (title, url) {
            if (!this._options.history) {
                return;
            }

            window.history.pushState(null, title, url);
        },
        _requestNext: function () {
            if (0 === this._requests.length) {
                return;
            }

            if ('defer' === this._options.concurrent && this._xhrs.length > 0) {
                return;
            }

            this._send(this._requests.shift());
            this._requestNext();
        },
        _send: function (request) {
            var base = this,
                $element = base._$element,
                xhr = new XMLHttpRequest();

            base._xhrs.push(xhr);

            xhr.open(request.method, request.url);
            xhr.timeout = base._options.timeout;
            base._xhrSetRequestHeaders(xhr, request.headers);
            xhr.addEventListener('abort', function () {
                $element.trigger('abort.frujax', [request]);
            });
            xhr.ontimeout = function () {
                $element.trigger('timeout.frujax', [request]);
            };
            xhr.addEventListener('load', function () {
                var response = base._createResponse(xhr, 'success');

                initDataFrujaxElements(response.$content);

                if (null !== base._options.redirect && null !== response.redirectLocation) {
                    $element.trigger('redirect.frujax', [request, response]);

                    base._handleRedirect(request, response.redirectStatusCode, response.redirectLocation);
                } else {
                    $element.trigger('success.frujax', [request, response]);

                    base._applyAction(response.$target, response.$content);
                    base._pushHistoryState(response.title, response.url);
                }
            });
            xhr.addEventListener('error', function () {
                var response = base._createResponse(xhr, 'error');

                $element.trigger('error.frujax', [request, response]);
            });
            xhr.addEventListener('loadend', function () {
                $element.trigger('finished.frujax', [request]);
                base._xhrs.splice(base._xhrs.indexOf(xhr), 1);
                setTimeout(function () {
                    base._requestNext();
                }, 0);
            });
            xhr.send(request.body);
        },
        _unbind: function () {
            this._$element
                .find(NAMED_BUTTON)
                .addBack()
                .off(INTERNAL_EVENT);
        },
        _xhrSetRequestHeaders: function (xhr, headers) {
            $.each(headers, function (name, value) {
                xhr.setRequestHeader(name, value);
            });
        },
    });
})(window, document, jQuery);
