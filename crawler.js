const request = require('request');
const cheerio = require('cheerio');
const URL = require('url-parse');

const START_URL = "https://www.bookdepository.com/bestsellers";
const MAX_BOOKS = 100;

let pagesVisited = {};
let numBooks = 0;
let pagesToVisit = [];
let booksToVisit = [];
let booksVisited = {};
let url = new URL(START_URL);
let baseUrl = url.protocol + "//" + url.hostname;

pagesToVisit.push(START_URL);
crawl();

function crawl() {
  if (numBooks >= MAX_BOOKS) {
    console.log("Reached max limit of books visit.");
    return;
  }
  if (booksToVisit.length > 0) {
    let book = booksToVisit.pop();
    analyzeBook(book, crawl);
  }
  else {
    let nextPage = pagesToVisit.pop();
    if (nextPage in pagesVisited) {
      crawl();
    } else {
      visitPage(nextPage, crawl);
    }
  }
}

function visitPage(url, callback) {
  pagesVisited[url] = true;

  console.log("Visiting page " + url);
  request(url, function (error, response, body) {
    // Check status code (200 is HTTP OK)
    console.log("Status code: " + response.statusCode);
    if (response.statusCode !== 200) {
      callback();
      return;
    }

    let $ = cheerio.load(body);

    findNextPage($);
    collectBookLinks($);

    callback();

  });
}

function analyzeBook(url, callback) {
  booksVisited[url]=true;
  numBooks++;
  request(url, function (error, response, body) {
    // Check status code (200 is HTTP OK)
    if (response.statusCode !== 200) {
      callback();
      return;
    }
    // Parse the document body
    let $ = cheerio.load(body);
    let title = $("h1").text();
    console.log("Found book " +title);

    callback();

  });
}

/*looks for pages with lists of books*/

function findNextPage($) {
  let links = $("li a[href^='/']", '.head-block');
  links.each(function () {
    relLink = $(this).attr('href');
    if (relLink.includes("page"))
      pagesToVisit.push(baseUrl + relLink);
  })
}

function collectBookLinks($) {
  var bookLinks = $("h3.title>a[href^='/']", '.content-block');
  //console.log("Found " + bookLinks.length + " book links on page");

  bookLinks.each(function () {
    let bookURL = baseUrl + $(this).attr('href');
    //console.log(bookURL);
    booksToVisit.push(bookURL);
  });

}