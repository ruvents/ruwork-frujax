# Frujax

A JavaScript library to send and process AJAX requests with ease.

## Installation

```html
<script src="https://code.jquery.com/jquery-3.3.1.slim.min.js"></script>
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
