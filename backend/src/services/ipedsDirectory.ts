import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type IpedsInstitution = {
  id: number;
  name: string;
  city: string;
  state: string;
  zip: string;
  ownership: string;
  level: string;
  degreeGranting: boolean;
  website: string | null;
  applicationUrl: string | null;
  financialAidUrl: string | null;
};

type Directory = {
  source: string;
  sourceUrl: string;
  year: number;
  institutions: IpedsInstitution[];
};

export type DirectoryOptions = {
  query: string;
  state: string;
  ownership: string;
  degreeGranting: string;
  page: number;
  pageSize: number;
};

let directoryPromise: Promise<Directory> | undefined;

function loadDirectory() {
  directoryPromise ??= (async () => {
    const location = resolve(process.cwd(), 'data/ipeds-directory.json');
    return JSON.parse(await readFile(location, 'utf8')) as Directory;
  })();
  return directoryPromise;
}

export async function searchIpedsDirectory(options: DirectoryOptions) {
  const directory = await loadDirectory();
  const query = options.query.toLocaleLowerCase();
  const filtered = directory.institutions.filter((institution) => {
    if (options.state && institution.state !== options.state) return false;
    if (options.ownership && institution.ownership !== options.ownership) return false;
    if (options.degreeGranting && institution.degreeGranting !== (options.degreeGranting === '1')) return false;
    if (query && !`${institution.name} ${institution.city} ${institution.state}`.toLocaleLowerCase().includes(query)) return false;
    return true;
  });
  const start = options.page * options.pageSize;

  return {
    source: directory.source,
    sourceUrl: directory.sourceUrl,
    sourceYear: directory.year,
    total: filtered.length,
    page: options.page,
    pageSize: options.pageSize,
    results: filtered.slice(start, start + options.pageSize),
  };
}