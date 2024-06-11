// ==UserScript==
// @name            Reddit Image Redirect
// @namespace       Reddit Scripts
// @match           *://*.reddit.com/media?*
// @match           *://*.reddit.com/*/*/comments/*
// @match           *://www.reddit.com/gallery/*
// @run-at          document-start
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_deleteValue
// @grant           GM_registerMenuCommand
// @version         1.0
// @author          themojache
// @source          https://github.com/themojache/userscripts
// @supportURL      https://github.com/themojache/userscripts/issues
// @description     UserScript implementation of https://github.com/nopperl/load-reddit-images-directly
// @licence         GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// ==/UserScript==

function fixImageLink(link, real = true) {
  var url = link.search && link.hostname && link.pathname ? link : new URL(link, window.location.href);
  let sp = url.searchParams ? url.searchParams : new URLSearchParams(url.search);
  if(options.redirectToOriginalImageEnabled == true && url.hostname == "preview.redd.it") {
    url.hostname = "i.redd.it";
    if(real) {
      url.search = "";
    }
    if(url.pathname.includes("-")) { //https://preview.redd.it/thoughts-on-the-gallery-wall-v0-2yusq3onz0yc1.jpg?width=640&crop=smart&auto=webp
      url.pathname = "/" + url.pathname.split("-").pop();
    }
  } else if(url.hostname.includes(".reddit.com") && url.pathname.toLowerCase() == "/media" && sp.has("url")) {
    return fixImageLink(sp.get("url"));
  }
  return url.href;
}
function blobToBase64(image) {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.onloadend = (e) => {
      if(e.target.error) {
        reject(e.target.error);
      } else if(e.target.result) {
        resolve(e.target.result);
      } else {
        reject("Cannot parse");
      }
    };
    reader.readAsDataURL(image);
  });
}
function addTo(new1, old1) {
  return old1.parentNode.insertBefore(new1, old1);
}
async function getOptions() {
  const optionsKey = "options";
  let def = JSON.stringify(options);
  let settingsStr = await GM_getValue(optionsKey, def);
  if(def != settingsStr) {
    options = Object.assign({}, options, JSON.parse(settingsStr));
  } else {
    GM_deleteValue(optionsKey);
  }
  let invalid = [null, undefined, ""];
  await Promise.all(Object.keys(options).map(async (option) => {
    var title = "Set variable " + option;
    GM_registerMenuCommand(title, () => {
      try {
        var input = JSON.parse(prompt(title, JSON.stringify(options[option])));
        if(!invalid.includes(input)) {
          options[option] = input;
          GM_setValue(optionsKey, JSON.stringify(options));
        }
      } catch (err) {
        error("Something went wrong:", err);
      }
    });
  }));
}

let options = {
  useOldAccept: false,
  disableGallery: true,
  redirectToOriginalImageEnabled: true
};
getOptions().then(() => {
  try {
    if(window.location.pathname.toLowerCase() == "/media") {
      fetch(fixImageLink(window.location), {
        method: "GET",
        mode: "cors",
        credentials: "same-origin",
        headers: {
          "accept": options.useOldAccept ? "image/png,image/*;q=0.8,*/*;q=0.5" : "image/avif,image/webp,*/*"
        },
        redirect: "follow"
      }).then(async data => {
        var blob = await data.blob();
        var link = await blobToBase64(blob);
        if(link) {
          window.location = link;
        }
      });
    } else if(options.disableGallery) {
      document.addEventListener("DOMContentLoaded", (event) => {
        let images = document.querySelectorAll(".media-gallery .gallery-tiles .media-preview-content img.preview");
        for(var img of images) {
          let a = document.createElement('a');
          a.href = fixImageLink(img.src);
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          let container = img.parentElement.parentElement;
          a.appendChild(container.cloneNode(true));
          addTo(a, container);
          container.remove();
        }
        let images2 = document.querySelectorAll("img.media-lightbox-img, [data-adclicklocation=media] figure a div");
        for(let img of images2) {
          if(img.parentNode.nodeName != "A") {
            let a = document.createElement('a');
            a.href = fixImageLink(img.src);
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            addTo(a, img);
            a.appendChild(img);
          } else if(!img.parentNode.href.includes("i.redd.it")) {
            let a = img.parentNode;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.href = fixImageLink(a.href);
          }
        }
      });
    }
  } catch(err) {
    console.log("Error occured redirecting", window.location.href, err);
  }
});
