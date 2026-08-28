/**
 * The twelve faces `@openview/engine` embeds, pinned by upstream release, length and SHA-256.
 *
 * Upstream ships them inside release archives only -- no per-file raw url exists -- so the
 * generator reads a local directory and refuses any byte that does not match this table. Changing
 * a pin is an audited operation: it changes the reproducibility profile of every render.
 */

export const RELEASES = {
  inter: {
    name: 'Inter',
    version: '4.1',
    licence: 'SIL Open Font License 1.1',
    archive: 'https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip',
    archiveSha256: '9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e',
    within: 'extras/ttf',
  },
  'noto-sans': {
    name: 'Noto Sans',
    version: '2.015',
    licence: 'SIL Open Font License 1.1',
    archive:
      'https://github.com/notofonts/latin-greek-cyrillic/releases/download/NotoSans-v2.015/NotoSans-v2.015.zip',
    archiveSha256: '0c34df072a3fa7efbb7cbf34950e1f971a4447cffe365d3a359e2d4089b958f5',
    commit: 'c4a321e123e4d4ff315f57f4e0adf294fe3a95be',
    within: 'NotoSans/unhinted/ttf',
  },
  'noto-serif': {
    name: 'Noto Serif',
    version: '2.015',
    licence: 'SIL Open Font License 1.1',
    archive:
      'https://github.com/notofonts/latin-greek-cyrillic/releases/download/NotoSerif-v2.015/NotoSerif-v2.015.zip',
    archiveSha256: '0e9a43c8a4b94ac76f55069ed1d7385bbcaf6b99527a94deb5619e032b7e76c1',
    commit: 'c4a321e123e4d4ff315f57f4e0adf294fe3a95be',
    within: 'NotoSerif/unhinted/ttf',
  },
};

/** Ordered exactly as the catalogue lists them: family, then regular, bold, italic, bold italic. */
export const FACES = [
  [
    'inter-4.1',
    'inter',
    'Inter-Regular.ttf',
    400,
    'normal',
    411640,
    '40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82',
  ],
  [
    'inter-4.1',
    'inter',
    'Inter-Bold.ttf',
    700,
    'normal',
    420428,
    '288316099b1e0a47a4716d159098005eef7c0066921f34e3200393dbdb01947f',
  ],
  [
    'inter-4.1',
    'inter',
    'Inter-Italic.ttf',
    400,
    'italic',
    417388,
    'bbc051dd204b5019a1aa0bc0ae2aa8a05ab13e7a3f979fa357631dc7feb6833a',
  ],
  [
    'inter-4.1',
    'inter',
    'Inter-BoldItalic.ttf',
    700,
    'italic',
    425296,
    '948405a16cdc62701da5f4005ed068ca5f4d27061d98f7974ccfc37831d9581d',
  ],
  [
    'noto-sans-2.015',
    'noto-sans',
    'NotoSans-Regular.ttf',
    400,
    'normal',
    431364,
    'f3961a9cde016d41a4879aecda1474d3a36d6bf54fa0e4643de029cc2248b0e8',
  ],
  [
    'noto-sans-2.015',
    'noto-sans',
    'NotoSans-Bold.ttf',
    700,
    'normal',
    432376,
    '87cb2d84472a7d66da659ee47b6cdb9552326e8c128245231f191b6ac72529d9',
  ],
  [
    'noto-sans-2.015',
    'noto-sans',
    'NotoSans-Italic.ttf',
    400,
    'italic',
    446880,
    '678288f868807d4d64a6f3b51466871d117d915780381ce9d0ed4b3bcbd06d37',
  ],
  [
    'noto-sans-2.015',
    'noto-sans',
    'NotoSans-BoldItalic.ttf',
    700,
    'italic',
    441936,
    '3d367743f371f28671d2764e911a53d7c20ec9b6aa8791d059e7090389fc52a5',
  ],
  [
    'noto-serif-2.015',
    'noto-serif',
    'NotoSerif-Regular.ttf',
    400,
    'normal',
    482540,
    'a15cfbbc1539d707115111d672d590a3d70d4f74b4c0a315956da20ae19a14e1',
  ],
  [
    'noto-serif-2.015',
    'noto-serif',
    'NotoSerif-Bold.ttf',
    700,
    'normal',
    481892,
    '24ad531e6b05ddad8c3d89572d2c93eb86a6b74e652ce7ee3c3e171de68e84c3',
  ],
  [
    'noto-serif-2.015',
    'noto-serif',
    'NotoSerif-Italic.ttf',
    400,
    'italic',
    513428,
    'c4b3c971741ecdb40f5a443bce754e8fe91efe761b6ea10c92be7c3597cdadc4',
  ],
  [
    'noto-serif-2.015',
    'noto-serif',
    'NotoSerif-BoldItalic.ttf',
    700,
    'italic',
    513280,
    '1bc4f86502eaa368718f6192bee022ea9a703d5af1c18b7d291212657b63074a',
  ],
].map(([family, release, file, weight, style, byteLength, sha256]) => ({
  family,
  release,
  file,
  weight,
  style,
  byteLength,
  sha256,
}));

/** The css family a face is served under: unrequestable from a template, versioned with the build. */
export const cssFamilyOf = (family) => `__openview_${family.replace(/[.-]/g, '_')}`;
