/**
 * Le logo de la facture de référence : un PNG 120x40 embarqué en base64.
 *
 * Embarqué et non référencé par URL, parce que la première stratégie PDF n'accepte que des
 * bitmaps `data:` — aucune requête ne sort de la page rendue. Un modèle peut déclarer une URL
 * HTTP, mais aucun renderer livré ne la résout encore.
 */
export const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAoCAIAAAC6iKlyAAAAZklEQVR4nO3QQQkAIADAQHvYxFL2/9lCYR4swLgx19aFxvODTwINuhVo0K1Ag24FGnQr0KBbgQbdCjToVqBBtwINuhVo0K1Ag24FGnQr0KBbgQbdCjToVqBBtwINuhVo0K1Ag251AEd4W9Pz3UCaAAAAAElFTkSuQmCC';
