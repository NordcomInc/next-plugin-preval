# next-plugin-preval · [![codecov](https://codecov.io/gh/ricokahler/next-plugin-preval/branch/main/graph/badge.svg?token=ZMYB4EW4SH)](https://codecov.io/gh/sweetsideofsweden/next-plugin-preval) [![github status checks](https://badgen.net/github/checks/ricokahler/next-plugin-preval/main)](https://github.com/sweetsideofsweden/next-plugin-preval/actions) [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

> Pre-evaluate async functions (for data fetches) at build time and import them like JSON

```js
// data.preval.js (or data.preval.ts)

// step 1: create a data.preval.js (or data.preval.ts) file
import preval from 'next-plugin-preval';

// step 2: write an async function that fetches your data
async function getData() {
  const { title, body } = await /* your data fetching function */;
  return { title, body };
}

// step 3: export default and wrap with `preval()`
export default preval(getData());
```

```js
// Component.js (or Component.ts)

// step 4: import the preval
import data from './data.preval';

// step 5: use the data. (it's there synchronously from the build step!)
const { title, body } = data;

function Component() {
  return (
    <>
      <h1>{title}</h1>
      <p>{body}</p>
    </>
  );
}

export default Component;
```

## Why?

The primary mechanism Next.js provides for static data is `getStaticProps` — which is a great feature and is the right tool for many use cases. However, there are other use cases for static data that are not covered by `getStaticProps`.

- **Site-wide data**: if you have static data that's required across many different pages, `getStaticProps` is a somewhat awkward mechanism because for each new page, you'll have to re-fetch that same static data. For example, if you use `getStaticProps` to fetch content for your header, that data will be re-fetched on every page change.
- **Static data for API routes**: It can be useful to pre-evaluate data fetches in API routes to speed up response times and offload work from your database. `getStaticProps` does not work for API routes while `next-plugin-preval` does.
- **De-duped and code split data**: Since `next-plugin-preval` behaves like importing JSON, you can leverage the optimizations bundlers have for importing standard static assets. This includes standard code-splitting and de-duping.
- **Zero runtime**: Preval files don't get sent to the browser, only their outputted JSON.

See the [recipes](#recipes) for concrete examples.

## Installation

### Install

```
yarn add next-plugin-preval
```

or

```
npm i next-plugin-preval
```

### Add to next.config.js

```js
// next.config.js
const createNextPluginPreval = require('next-plugin-preval/config');
const withNextPluginPreval = createNextPluginPreval();

module.exports = withNextPluginPreval(/* optionally add a next.js config */);
```

## Usage

Create a file with the extension `.preval.ts` or `.preval.js` then export a promise wrapped in `preval()`.

```js
// my-data.preval.js
import preval from 'next-plugin-preval';

async function getData() {
  return { hello: 'world'; }
}

export default preval(getData());
```

Then import that file anywhere. The result of the promise is returned.

```js
// component.js (or any file)
import myData from './my-data.preval'; // 👈 this is effectively like importing JSON

function Component() {
  return (
    <div>
      <pre>{JSON.stringify(myData, null, 2)}</pre>
    </div>
  );
}

export default Component;
```

When you import a `.preval` file, it's like you're importing JSON. `next-plugin-preval` will run your function during the build and inline a JSON blob as a module.

## ⚠️ Important notes

This works via a webpack loader that takes your code, compiles it, and runs it inside of Node.js.

- Since this is an optimization at the bundler level, it will not update with Next.js [preview mode](https://nextjs.org/docs/advanced-features/preview-mode), during dynamic SSR, or even [ISR](https://nextjs.org/docs/basic-features/data-fetching#incremental-static-regeneration). Once this data is generated during the initial build, it can't change. It's like importing JSON. See [this pattern](#supporting-preview-mode) for a work around.
- Because this plugin runs code directly in Node.js, code is not executed in the typical Next.js server context. This means certain injections Next.js does at the bundler level will not be available. We try our best to mock this context via [`require('next')`](https://github.com/ricokahler/next-plugin-preval/issues/12). For most data queries this should be sufficient, however please [open an issue](https://github.com/ricokahler/next-plugin-preval/issues/new) if something seems off.

## Recipes

### Site-wide data: Shared header

```js
// header-data.preval.js
import preval from 'next-plugin-preval';

async function getHeaderData() {
  const headerData = await /* your data fetching function */;

  return headerData;
}

export default preval(getHeaderData());
```

```js
// header.js
import headerData from './header-data.preval';
const { title } = headerData;

function Header() {
  return <header>{title}</header>;
}

export default Header;
```

### Static data for API routes: Pre-evaluated listings

```js
// products.preval.js
import preval from 'next-plugin-preval';

async function getProducts() {
  const products = await /* your data fetching function */;

  // create a hash-map for O(1) lookups
  return products.reduce((productsById, product) => {
    productsById[product.id] = product;
    return productsById;
  }, {});
}

export default preval(getProducts());
```

```js
// /pages/api/products/[id].js
import productsById from '../products.preval.js';

const handler = (req, res) => {
  const { id } = req.params;

  const product = productsById[id];

  if (!product) {
    res.status(404).end();
    return;
  }

  res.json(product);
};

export default handler;
```

### Code-split static data: Loading non-critical data

```js
// states.preval.js
import preval from 'next-plugin-preval';

async function getAvailableStates() {
  const states = await /* your data fetching function */;
  return states;
}

export default preval(getAvailableStates());
```

```js
// state-picker.js
import { useState, useEffect } from 'react';

function StatePicker({ value, onChange }) {
  const [states, setStates] = useState([]);

  useEffect(() => {
    // ES6 dynamic import
    import('./states.preval').then((response) => setStates(response.default));
  }, []);

  if (!states.length) {
    return <div>Loading…</div>;
  }

  return (
    <select value={value} onChange={onChange}>
      {states.map(({ label, value }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
```

### Supporting preview mode

As stated in the [notes](#%EF%B8%8F-important-notes), the result of next-plugin-preval won't change after it leaves the build. However, you can still make preview mode work if you extract your data fetching function and conditionally call it based on preview mode (via [`context.preview`](https://nextjs.org/docs/advanced-features/preview-mode#step-2-update-getstaticprops). If preview mode is not active, you can default to the preval file.

```js
// get-data.js

// 1. extract a data fetching function
async function getData() {
  const data = await /* your data fetching function */;
  return data
}
```

```js
// data.preval.js
import preval from 'next-plugin-preval';
import getData from './getData';

// 2. use that data fetching function in the preval
export default preval(getData());
```

```js
// /pages/some-page.js
import data from './data.preval';
import getData from './get-data';

export async function getStaticProps(context) {
  // 3. conditionally call the data fetching function defaulting to the prevalled version
  const data = context.preview ? await getData() : data;
  
  return { props: { data } };
}
```

## Related Projects

- [`next-data-hooks`](https://github.com/ricokahler/next-data-hooks) — creates a pattern to use `getStaticProps` as React hooks. Great for the site-wide data case when preview mode or ISR is needed.
