// Type declarations for the assets, which are handled by vite
declare module '*.css';
declare module '*.png' {
    const src: string;
    export default src;
}
declare module '*.svg' {
    const src: string;
    export default src;
}
