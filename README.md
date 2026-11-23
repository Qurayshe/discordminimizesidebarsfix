# discord sidebar minimizer (optimized)

somewhat more performant version of the various discord sidebar minimize userstyles and extensions i found online, which worked fine on my desktop but were very slow on my laptop. replaces stuff like `:has()`, wildcard class selectors, universal css var overrides, and layout-thrashing width/grid animations with tagged DOM classes and basic transitions with lighter css/js etc to keep my poor aging thinkpad from exploding.

## installation

1. if you dont have a userscript manager already, try [tampermonkey](https://www.tampermonkey.net/) or [violentmonkey](https://violentmonkey.github.io/).
2. Open the extension dashboard and drag-and-drop `discord-minimize-sidebars-fast.user.js` onto it (or create a new userscript and copypaste in the code from the .js file).
3. disable any userstyles or other scripts that might override this one (like the ), then reload Discord.
4. use the **configure** button in the userscript menu to adjust settings.