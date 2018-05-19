# Frujax

A JavaScript library to send and process AJAX requests with ease.

## Installation

```html
<script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
<!--jQuery Form Plugin is required for submitting forms-->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.form/4.2.2/jquery.form.min.js"></script>
<script src="frujax.js"></script>
```

## Usage

```js
$('.frujax-btn').frujax({
    url: '/ajax',
    target: '#container'
});
```

Or you can use `data-frujax` attribute to quickly setup frujax on any element.

```html
<button data-frujax='{"url": "/ajax", "target": "#container"}'>Action!</button>
```

Clicking the link will load the contents of the `/ajax` page into the `#container` element.

## Options

### action

Type: `null|string`. Default: `fill`.

Actions to be applied to the target element:

- `fill`: replace target's contents with resource (see [.html()](http://api.jquery.com/html/)),
- `replace`: replace target with resource (see [.replaceWith()](http://api.jquery.com/replaceWith/)),
- `prepend`: insert resource to the beginning of the target (see [.prepend()](http://api.jquery.com/prepend/)),
- `append`: insert resource to the end of the target (see [.append()](http://api.jquery.com/append/)),
- `after`: insert resource after the target (see [.after()](http://api.jquery.com/after/)),
- `before`: insert resource before the target (see [.before()](http://api.jquery.com/before/)).

### ajaxOptions

Type: `object`. Default: `{}`.

See [jQuery.ajax()](http://api.jquery.com/jquery.ajax/). Note: `ajaxOptions.url` overrides `url`.

### autoload

Type: `bool`. Default: `false`.

If `true`, request is performed immediately after initialization.

### data

Type: `object`. Default: `{}`.

Alias for `ajaxOptions.data`.

### filter

Type: `null|<selector>`. Default: `null`.

If not empty, the result will be filtered according to the selector. `context.$content` will contain the filtered result.

### headers

Type: `object`. Default: `{}`.

Alias for `ajaxOptions.headers`.

### history

Type: `bool`. Default: `false`.

If `true`, requested url is pushed to the browser history.

### interceptRedirect

Type: `bool`. Default: `true`.

If `true`, the plugin sends a `Frujax-Intercept-Redirect: 1` header and expects a `2xx` response with `Frujax-Redirect-Location` and `Frujax-Redirect-Status-Code` headers in case of a redirect.

### method

Type: `null|string`. Default: `null`.

Alias for `ajaxOptions.type` (`ajaxOptions.method`). If `source` is a form and `method` is `null`, jQuery Form Plugin will use form's `method`.

### on

Type: `string`. Default: `submit` for forms, `click` for links and buttons, `change` for form controls.

Events that will trigger request (see the first argument of [.on()](http://api.jquery.com/on/)).

### preventDefault

Type: `bool`. Default: `true`.

If `true`, the default browser action will not be triggered (see [event.preventDefault()](https://api.jquery.com/event.preventdefault/)).

### redirectMode

Type: `string`. Default: `follow`.

Strategies for handling response with a `Frujax-Redirect-Location` header:

- `follow`: request redirect url with same options,
- `assign`: load redirect url in the current window (see [Location.assign()](https://developer.mozilla.org/en-US/docs/Web/API/Location/assign)),
- `replace`: replace the current resource with the one at the redirect url (see [Location.replace()](https://developer.mozilla.org/en-US/docs/Web/API/Location/replace)).

### serialMode

Type: `string`. Default: `async`.

Strategies for handling sequential calls (when specified events trigger before the last request terminates):

- `async`: let frujax make any number of parallel requests,
- `force`: abort the pending request and make a new one,
- `lock`: ignore new calls until the last one terminates.

### source

Type: `null|self|<selector>`. Default: `self` (frujax element).

This option allows to set a selector for elements which will provide data for the request. If source is a form element, jQuery Form Plugin will be used. Otherwise data from selected elements will be retrieved with [.serializeArray()](https://api.jquery.com/serializeArray/).

### target

Type: `null|self|<selector>`. Default: `self` (frujax element).

Element to apply action to.

### timeout

Type: `int`. Default: `0`.

Alias for `ajaxOptions.timeout`.

### url

Type: `null|string`. Default: `null`.

Alias for `ajaxOptions.url`. If `source` is a form and `url` is `null`, jQuery Form Plugin will use form's `action`.

## Global defaults

To set a dynamic default value, use a callback with `$element` argument.

To perform a deep merge of defaults, pass true as a second argument.

```js
// getter
var frujaxDefaults = $.frujaxDefaults();

// setter
$.frujaxDefaults({
    action: 'replace',
    timeout: 1000,
    method: 'post',
    url: function ($element) {
        if ($element.is('a')) {
            return $element.prop('href');
        }

        return null;
    },
});
```

## Methods

### abort

Abort last AJAX request.

```js
$frujaxElement.frujax('abort');
```

### destroy

Aborts pending requests, removes all data and unbinds all internal events.

```js
$frujaxElement.frujax('destroy');
```

### options(options, deep)

Getter and setter for element's options.

To perform a deep merge of options, pass true as a second argument.

```js
// get current element's options 
var options = $frujaxElement.frujax('options');

// override some options
$frujaxElement.frujax('options', {
    target: '#newTarget'
});
```

Note: `refresh` method must be called if `on` was changed.

### refresh

Aborts pending requests, rebinds internal events.

### request(ajaxOptions, ignoreSource)

Performs an AJAX request with specified AJAX options. `ajaxOptions` will be deeply merged into element's `ajaxOptions` only for this request.

Set `ignoreSource` to `true` to prevent form data submission or source elements serialization.

```js
$frujaxElement.frujax('request', {
    cache: false
});
```

## Events

### before.frujax

Fires right before the `jqXHR` object was formed. Gives access to `ajaxOptions`.

```js
$frujaxElement.on('before.frujax', function(event, ajaxOptions) {
    ajaxOptions.url = '/new';
});
```

### always.frujax

Fires after any response.

```js
$frujaxElement.on('always.frujax', function(event, context) {
    // response data in a form of a jQuery element. null if request failed
    context.$content;
    // target jQuery element
    context.$target;
    context.ajaxOptions;
    // null for successful requests
    context.errorThrown;
    context.jqXHR;
    // Frujax-Redirect-Location response header or null if empty
    context.redirectLocation;
    // Frujax-Redirect-Status-Code response header or null if empty
    context.redirectStatusCode;
    context.textStatus;
    // Frujax-Title response header or null if empty
    context.title;
    // Frujax-Url header or requested url
    context.url;
    var value = context.getHeader('X-Value');
});
```

### success.frujax

Fires if AJAX request succeeds.

```js
$frujaxElement.on('success.frujax', function(event, context) {
    // see always.frujax for context argument description
});
```

### fail.frujax

Fires if AJAX request fails.

```js
$frujaxElement.on('fail.frujax', function(event, context) {
    // see always.frujax for context argument description
});
```

### redirect.frujax

Fires if a redirect was detected.

```js
$frujaxElement.on('redirect.frujax', function(event, context) {
    // see always.frujax for context argument description
});
```
