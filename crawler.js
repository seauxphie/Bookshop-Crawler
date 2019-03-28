const request = require('request');
const cheerio = require('cheerio');
const URL = require('url-parse');
const CliProgress = require('cli-progress');

const START_URL = "https://www.bookdepository.com/bestsellers";
const MAX_BOOKS = 1000; //no more than 1000
const currency = 'zł'
const progressBar = new CliProgress.Bar({
  format: '[{bar}] {percentage}% | ETA: {eta}s'
}, CliProgress.Presets.shades_classic);

let numBooks = 0; //number of processed books
let pagesVisited = {}; //pages where e're looking for books
let booksVisited = {}; //product pages
let pagesToVisit = [];
let booksToVisit = [];
let bookInfo = []; //array of processed books
let result;
let url = new URL(START_URL);
let baseUrl = url.protocol + "//" + url.hostname;

function crawl() {
  if (numBooks >= MAX_BOOKS) {
    processData();
    return;
  }
  else if (booksToVisit.length > 0) {
    let book = booksToVisit.pop();
    if (book in booksVisited) crawl();
    else analyzeBook(book);
  }
  else if (pagesToVisit.length > 0) {
    let nextPage = pagesToVisit.pop();
    if (nextPage in pagesVisited) crawl();
    else visitPage(nextPage);
  }
  else processData();
  return;
}

function visitPage(url) {
  pagesVisited[url] = true;

  request(url, function (error, response, body) {
    if (response.statusCode !== 200) { //200 is HTTP OK
      crawl();
      return;
    }

    let $ = cheerio.load(body);

    findNextPage($);
    collectBookLinks($);

    crawl();
  });
}

function analyzeBook(url) {
  booksVisited[url] = true;
  numBooks++;
  progressBar.increment();

  request(url, function (error, response, body) {

    if (response.statusCode !== 200) {//200 is HTTP OK
      crawl();
      return;
    }

    let $ = cheerio.load(body);

    let title = $("h1").text();
    let price = $(".sale-price").text();
    let numPages = $("span[itemprop='numberOfPages']").text();
    let author = $("span[itemprop='author']>a >span[itemprop='name']").text();
    price = processPrice(price);
    numPages = processPageNum(numPages);
    author = processAuthor(author);

    let book = {};
    book['title'] = title;
    book['author'] = author;
    book['pages'] = numPages;
    book['price'] = price;
    bookInfo.push(book);

    crawl();

  });
}

/*looks for pages with lists of books*/

function findNextPage($) {
  let links = $("li a[href^='/']", '.head-block');
  links.each(function () {
    relLink = $(this).attr('href');
    if (relLink.includes("page")) pagesToVisit.push(baseUrl + relLink);
  })
}

/*looks for info at product pages*/

function collectBookLinks($) {
  let bookLinks = $("h3.title>a[href^='/']", '.content-block');
  bookLinks.each(function () {
    booksToVisit.push(baseUrl + $(this).attr('href'));
  });

}

function processPrice(str) {
  price = str.replace(" " + currency, "").replace(",", ".");
  return price;
}

function processPageNum(str) {
  pages = str.trim().replace(" pages", "");
  return pages;
}

function processAuthor(str) {
  author = str.trim();
  for (let i = 0; i < author.length; i++)  author = author.replace(/\s\s+/, ', ');
  return author;
}

//PROCESS COLLECTED DATA
function processData() {
  let avg = 0;
  for (book in bookInfo) {
    let pricePerPage = bookInfo[book]['price'] / bookInfo[book]['pages'];
    pricePerPage = Number(Math.round(pricePerPage + 'e2') + 'e-2')
    if (pricePerPage) avg += pricePerPage;
    bookInfo[book]['priceperpage'] = pricePerPage;
  }
  result=bookInfo.sort(compare);
  avg /= numBooks;
  avg=Number(Math.round(avg + 'e2') + 'e-2')
  let index = Math.min(10, numBooks);
  let cheap = bookInfo.slice(0, index);
  let expensive = bookInfo.slice(-index).reverse();

  //LOG RESULTS TO CONSOLE

  console.log("\n\nAnalyzed " + numBooks + " bestsellers.");
  console.log("Average price per page: " + avg + " " + currency + '\n');
  console.log("Books with the smallest price per page:");
  console.table(cheap);
  console.log("\nBooks with the biggest price per page:");
  console.table(expensive);
  process.exit(0);
}


//needed for sorting the bookInfo array by price per page
function compare(x, y) {
  if (x['priceperpage'] < y['priceperpage']) return -1;
  if (x['priceperpage'] > y['priceperpage']) return 1;
  return 0;
}

//BEGIN

console.log("Looking for books...");
progressBar.start(MAX_BOOKS, 0);
pagesToVisit.push(START_URL);
crawl();
