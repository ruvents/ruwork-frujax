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
$('a.frujax-link').frujax({
    target: '#container'
});
```

Or you can use `data-frujax` attribute to quickly setup frujax on any element.

```html
<a href="/ajax" data-frujax='{"target": "#container"}'>Link</a>
```

On click at this link the contents of the `/ajax` page will be inserted into the `#container` element.

## Options

### action

Type: `string`.

Default: `'fill'`.

Actions to be applied to the target element:

- `fill`: replace target's contents with resource (see [jQuery().html()](http://api.jquery.com/html/)),
- `replace`: replace target with resource (see [jQuery().replaceWith()](http://api.jquery.com/replaceWith/)),
- `prepend`: insert resource to the beginning of the target (see [jQuery().prepend()](http://api.jquery.com/prepend/)),
- `append`: insert resource to the end of the target (see [jQuery().append()](http://api.jquery.com/append/)),
- `after`: insert resource after the target (see [jQuery().after()](http://api.jquery.com/after/)),
- `before`: insert resource before the target (see [jQuery().before()](http://api.jquery.com/before/)).

### ajaxOptions

Type: `object`.

Default: `{dataType: 'html'}`.

See [jQuery.ajax()](http://api.jquery.com/jquery.ajax/). Note: `ajaxOptions.url` overrides `url`.

### autoload

Type: `bool`.

Default: `false`.

If `true`, request is performed immediately after initialization.

### history

Type: `bool`.

Default: `false`.

If `true`, requested url is pushed to the browser history.

### interceptRedirect

Type: `bool`.

Default: `true`.

If `true`, the plugin sends a `Frujax-Intercept-Redirect: 1` header and expects a `2xx` response with `Frujax-Redirect-Url` header in case of a redirect.

### on

Type: `string|function($element)`.

Default: `submit` for forms, `click` for links and buttons.

Events that will trigger request (see [jQuery().on()](http://api.jquery.com/on/)).

### preventDefault

Type: `bool`.

Default: `true`.

If `true`, the default browser action is prevented.

### redirectMode

Type: `string`.

Default: `'follow'`.

Strategies for handling the response `Frujax-Redirect-Url` header:

- `follow`: request redirect url with same options,
- `assign`: load redirect url in the current window (see [Location.assign()](https://developer.mozilla.org/en-US/docs/Web/API/Location/assign)),
- `replace`: replace the current resource with the one at the redirect url (see [Location.replace()](https://developer.mozilla.org/en-US/docs/Web/API/Location/replace)).

### serialMode

Type: `string`.

Default: `'async'`.

Strategies for handling sequential calls (when specified events trigger before the last request terminates):

- `async`: let frujax make any number of parallel requests,
- `force`: abort the pending request and make a new one,
- `lock`: ignore new calls until the last one terminates.

### target

Type: `null|<selector>`.

Default: `null`.

Element to apply action to. If `null`, the frujax element itself is a target.

### url

Type: `null|string|function($element)`.

Default: `href` for `<a>` tags, `action` for forms.

Resource url (a quick alias for `ajaxOptions.url`).

## Global defaults

```js
// getter
var frujaxDefaults = $.frujaxDefaults();

// setter
$.frujaxDefaults({
    action: 'replace',
    ajaxOptions: {
        timeout: 1000,
        method: 'post'
    }
});
```

## Methods

### options

Getter and setter for element's options.

```js
// get current element's options 
var options = $frujaxElement.frujax('options');

// override some options
$frujaxElement.frujax('options', {
    target: '#newTarget'
});
```

Note: `refresh` method must be called if `on` was changed.

### destroy

Aborts pending requests, removes all data and unbinds all internal events.

```js
$frujaxElement.frujax('destroy');
```

### refresh

Aborts pending requests, rebinds internal events.

### request

Performs an AJAX request with specified AJAX options.

```js
$frujaxElement.frujax('request', {
    cache: false
});
```

### abort

Abort last AJAX request.

```js
$frujaxElement.frujax('abort');
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
    // Frujax-Redirect-Url response header or null if empty
    context.redirectUrl;
    context.textStatus;
    // Frujax-Title response header or null if empty
    context.title;
    // Frujax-Url header or requested url
    context.url;
    context.getHeader(name);
});
```

### success.frujax

Fires if AJAX request succeeds.

```js
$frujaxElement.on('success.frujax', function(event, context) {
});
```

### fail.frujax

Fires if AJAX request fails.

```js
$frujaxElement.on('fail.frujax', function(event, context) {
});
```

### redirect.frujax

Fires if a redirect was detected.

```js
$frujaxElement.on('redirect.frujax', function(event, context) {
});
```

### acted.frujax

Fires right after the action was applied (only on successful requests obviously).

```js
$frujaxElement.on('acted.frujax', function(event, context) {
});
```
