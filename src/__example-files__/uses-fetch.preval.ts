import preval from 'next-plugin-preval';

async function getDataViaFetch() {
  const response = await fetch(
    'https://api.github.com/repos/sweet-side-of-sweden/next-plugin-preval/readme'
  );
  const result = await response.json();

  return result.name;
}

export default preval(getDataViaFetch());
