;(function (window, document, $) {
    'use strict';

    // Constants

    var EVENT_CLASS = '.frujax',
        INSTANCE_NAME = 'frujaxInstance',
        INTERNAL_EVENT_CLASS = '._frujax_internal',
        NAMED_BUTTON_SELECTOR = ':submit[name!=""][name]',
        NON_INHERITED_OPTIONS = ['autoload', 'extend', 'on', 'preventDefault'],
        SELECTOR_OPTIONS = ['target', 'with'];

    // Serial autoload

    var autoloadQueue = [];

    var autoloadBlocked = false;

    var autoloadNext = function () {
        if (autoloadBlocked || 0 === autoloadQueue.length) {
            return;
        }

        autoloadBlocked = true;
        autoloadQueue
            .shift()
            .one('loadend' + EVENT_CLASS + INTERNAL_EVENT_CLASS, function () {
                autoloadBlocked = false;
                autoloadNext();
            })
            .frujax('request');
    };

    // Initialization of [data-frujax] elements

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

    // Helpers

    var deepFreeze = function (object) {
        Object.freeze(object);

        Object.keys(object).forEach(function (property) {
            var value = object[property],
                type = typeof value;

            if (('object' === type || 'function' === type) && !Object.isFrozen(value)) {
                deepFreeze(value);
            }
        });
    };

    // Plugin definition

    $.fn.frujax = function (options) {
        var args = arguments;

        if (!options || 'object' === typeof options) {
            return this.each(function () {
                if (!($.data(this, INSTANCE_NAME) instanceof Frujax)) {
                    $.data(this, INSTANCE_NAME, new Frujax(this, options));
                }
            });
        } else if ('string' === typeof options && '_' !== options[0]) {
            var result;

            this.each(function () {
                var instance = $.data(this, INSTANCE_NAME);

                if (instance instanceof Frujax && 'function' === typeof instance[options]) {
                    result = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
                }

                if ('destroy' === options) {
                    $.data(this, INSTANCE_NAME, null);
                }
            });

            return 'undefined' === typeof (result) ? this : result;
        }
    };

    // Plugin globals

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
        extend: null,
        filter: null,
        headers: {},
        history: false,
        method: null,
        on: null,
        preventDefault: true,
        target: '.',
        timeout: 0,
        url: null,
        with: '.',
    };

    $.fn.frujax.is = function (element) {
        return $(element).data(INSTANCE_NAME) instanceof Frujax;
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

    // Library

    var Frujax = function (element, options) {
        this._$element = $(element);
        this._xhrs = [];
        this._requests = [];
        this._configure(options || {});
        this._bind();

        if (this._options.autoload) {
            if ($.fn.frujax.serialAutoload) {
                autoloadQueue.push(this._$element);
                setTimeout(autoloadNext, 0);
            } else {
                this.request();
            }
        }
    };

    Frujax.prototype.abort = function () {
        this._requests = [];
        this._xhrs.slice(0).forEach(function (xhr) {
            xhr.abort();
        });
    };

    Frujax.prototype.destroy = function () {
        this.abort();
        this._unbind();
    };

    Frujax.prototype.options = function () {
        return this._options;
    };

    Frujax.prototype.request = function () {
        if (this._xhrs.length > 0) {
            if ('propel' === this._options.concurrent) {
                this.abort();
            } else if ('ignore' === this._options.concurrent) {
                return;
            }
        }

        var request = {
            method: this._getMethod(),
            url: this._getUrl(),
            headers: this._getHeaders(),
            data: this._getData(),
            files: this._getFiles(),
        };

        this._trigger('request', [request]);
        this._requests.push(request);
        this._requestNext();
    };

    Frujax.prototype._applyAction = function ($target, $content) {
        var action = this._options.action;

        if ('string' === typeof action && action in $.fn.frujax.actions) {
            action = $.fn.frujax.actions[action];
        } else if ('function' !== typeof action) {
            return;
        }

        action.call(this._$element, $target, $content);
    };

    Frujax.prototype._bind = function () {
        var _this = this,
            $element = this._$element,
            on = this._getOn();

        if (!on) {
            return;
        }

        on = (on + ' ').replace(/\b /g, INTERNAL_EVENT_CLASS + ' ');

        $element.on(on, function (event) {
            if (_this._options.preventDefault) {
                event.preventDefault();
            }

            _this.request();
        });

        $element
            .find(NAMED_BUTTON_SELECTOR)
            .addBack(NAMED_BUTTON_SELECTOR)
            .on('click' + INTERNAL_EVENT_CLASS, function () {
                var $button = $(this);

                $element.one('request' + EVENT_CLASS + INTERNAL_EVENT_CLASS, function (event, request) {
                    var name = $button.prop('name');

                    if (name) {
                        request.data.push({name: name, value: $button.prop('value')});
                    }
                });
            });
    };

    Frujax.prototype._configure = function (options) {
        var _this = this,
            $parent = this._createSelector(options.extend)().first(),
            parentOptions = {};

        if ($parent.length > 0 && $.fn.frujax.is($parent)) {
            var allParentOptions = $parent.frujax('options');

            Object.keys(allParentOptions).forEach(function (name) {
                if (NON_INHERITED_OPTIONS.indexOf(name) < 0) {
                    parentOptions[name] = allParentOptions[name];
                }
            });
        }

        this._options = $.extend(true, {}, $.fn.frujax.defaults, parentOptions, options);

        SELECTOR_OPTIONS.forEach(function (name) {
            _this._options[name] = _this._createSelector(_this._options[name]);
        });

        this._trigger('options', [this._options]);

        deepFreeze(this._options);
    };

    Frujax.prototype._createSelector = function (selector) {
        if ('function' === typeof selector) {
            return selector;
        }

        if (!selector) {
            return function () {
                return $([]);
            };
        }

        var _this = this;

        if ('.' === selector) {
            return function () {
                return _this._$element;
            };
        }

        var matches = selector.match(/^(\w+)\((.*)\)$/);

        if (null === matches) {
            return function () {
                return $(selector);
            };
        }

        return function () {
            return _this._$element[matches[1]](matches[2]);
        };
    };

    Frujax.prototype._getData = function () {
        var data = [],
            $with = this._options.with();

        this._objectDataToArrayData(data, this._options.data);

        return data.concat($with.serializeArray());
    };

    Frujax.prototype._getFiles = function () {
        return this._options
            .with()
            .map(function () {
                var elements = $.prop(this, 'elements');
                return elements ? $.makeArray(elements) : this;
            })
            .filter(':file[name!=""][name]')
            .map(function (i, element) {
                return jQuery.map(this.files, function (file) {
                    return {name: element.name, value: file};
                });
            })
            .get();
    };

    Frujax.prototype._getHeaders = function () {
        return $.extend(true, {}, this._options.headers, {
            'Frujax': 1,
            'X-Requested-With': 'XMLHttpRequest',
        });
    };

    Frujax.prototype._getMethod = function () {
        return (this._options.method || this._$element.prop('method') || 'GET').toUpperCase();
    };

    Frujax.prototype._getOn = function () {
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
    };

    Frujax.prototype._getUrl = function () {
        if ('string' === typeof this._options.url) {
            return this._options.url;
        }

        if ('string' === typeof this._$element.prop('action')) {
            return this._$element.prop('action');
        }

        if ('string' === typeof this._$element.prop('href')) {
            return this._$element.prop('href');
        }

        return window.location.href || '';
    };

    Frujax.prototype._objectDataToArrayData = function (arrayData, objectData, name) {
        if ('object' === typeof objectData) {
            var _this = this;

            Object.keys(objectData).forEach(function (key) {
                if (name) {
                    _this._objectDataToArrayData(arrayData, objectData[key], name + '[' + key + ']');
                } else {
                    _this._objectDataToArrayData(arrayData, objectData[key], key);
                }
            });
        } else {
            arrayData.push({name: name, value: objectData});
        }
    };

    Frujax.prototype._requestNext = function () {
        if (0 === this._requests.length) {
            return;
        }

        if ('defer' === this._options.concurrent && this._xhrs.length > 0) {
            return;
        }

        this._sendRequest(this._requests.shift());
        this._requestNext();
    };

    Frujax.prototype._sendRequest = function (request) {
        var _this = this,
            xhr = new XMLHttpRequest(),
            url = request.url,
            body = null;

        this._trigger('presend', [request, xhr]);

        if ('GET' === request.method) {
            var query = $.param(request.data);

            if (query) {
                url += (url.indexOf('?') < 0 ? '?' : '&') + query;
            }
        } else {
            body = new FormData();

            request.data
                .concat(request.files)
                .forEach(function (item) {
                    body.append(item.name, item.value);
                });
        }

        xhr.open(request.method, url);

        Object.keys(request.headers).forEach(function (name) {
            xhr.setRequestHeader(name, request.headers[name]);
        });

        xhr.timeout = this._options.timeout;

        xhr.onloadstart = function (event) {
            _this._trigger('loadstart', [event, xhr]);
        };

        xhr.onloadprogress = function (event) {
            _this._trigger('loadprogress', [event, xhr]);
        };

        xhr.onabort = function (event) {
            _this._trigger('abort', [event, xhr]);
        };

        xhr.onerror = function (event) {
            _this._trigger('error', [event, xhr]);
        };

        xhr.onload = function (event) {
            _this._trigger('load', [event, xhr]);

            if (xhr.status >= 400) {
                _this._trigger('failure', [xhr]);
                return;
            }

            if (xhr.status < 200 || xhr.status >= 300) {
                console.warn('Unexpected status code: ' + xhr.status + '.');
                return;
            }

            var $content = $(xhr.responseText),
                $target = _this._options.target();

            if (_this._options.filter && !$content.is(_this._options.filter)) {
                $content = $content.find(_this._options.filter).first();
            }

            _this._trigger('success', [xhr, $content, $target]);
            _this._applyAction($target, $content);
            initDataFrujaxElements($content);

            if (_this._options.history) {
                window.history.pushState(
                    null,
                    xhr.getResponseHeader('Frujax-Title') || '',
                    xhr.getResponseHeader('Frujax-Url') || null
                );
            }
        };

        xhr.ontimeout = function (event) {
            _this._trigger('timeout', [event, xhr]);
        };

        xhr.onloadend = function (event) {
            _this._trigger('loadend', [event, xhr]);
            _this._xhrs.splice(_this._xhrs.indexOf(xhr), 1);
            setTimeout(function () {
                _this._requestNext();
            }, 0);
        };

        xhr.send(body);

        this._xhrs.push(xhr);
    };

    Frujax.prototype._trigger = function (event, args) {
        this._$element.trigger(event + EVENT_CLASS, args);
    };

    Frujax.prototype._unbind = function () {
        this._$element
            .find(NAMED_BUTTON_SELECTOR)
            .addBack()
            .off(INTERNAL_EVENT_CLASS);
    };
})(window, document, jQuery);
