import path from 'node:path';

export interface LibraryPaths {
  root: string;
  sources: string;
  exports: string;
  config: string;
  strudelMap: string;
}

export function getLibraryRoot(): string {
  const cliValue = process.argv.find((arg) => arg.startsWith('--library='));
  const cliSplitIndex = process.argv.indexOf('--library');
  const splitValue = cliSplitIndex >= 0 ? process.argv[cliSplitIndex + 1] : undefined;

  return path.resolve(
    cliValue?.slice('--library='.length) ??
      splitValue ??
      process.env.STRUDEL_CHOP_LIBRARY ??
      'strudel-chop-library'
  );
}

export function getPort(): number {
  const cliValue = process.argv.find((arg) => arg.startsWith('--port='));
  const cliSplitIndex = process.argv.indexOf('--port');
  const splitValue = cliSplitIndex >= 0 ? process.argv[cliSplitIndex + 1] : undefined;
  const raw = cliValue?.slice('--port='.length) ?? splitValue ?? process.env.PORT ?? '5432';

  return Number.parseInt(raw, 10);
}

export function getLibraryPaths(root = getLibraryRoot()): LibraryPaths {
  return {
    root,
    sources: path.join(root, 'sources'),
    exports: path.join(root, 'exports'),
    config: path.join(root, 'strudel-chop.config.json'),
    strudelMap: path.join(root, 'exports', 'strudel.json')
  };
}

export function metadataPathForSource(sourcePath: string): string {
  const parsed = path.parse(sourcePath);

  return path.join(parsed.dir, `${parsed.name}.strudel-chop.json`);
}

export function sourceIdFromFile(fileName: string): string {
  return path.parse(fileName).name;
}
