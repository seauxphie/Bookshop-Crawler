const request = require('request');
const cheerio = require('cheerio');
const URL = require('url-parse');

const START_URL = "https://www.bookdepository.com/bestsellers";
const MAX_BOOKS = 10; //no more than 1000
const currency = 'zł'

let pagesVisited = {};
let numBooks = 0;
let pagesToVisit = [];
let booksToVisit = [];
let booksVisited = {};
let bookInfo=[];
let url = new URL(START_URL);
let baseUrl = url.protocol + "//" + url.hostname;

function crawl() {
  if (numBooks >= MAX_BOOKS) {
    console.log("Reached max limit of books visit.");
    analyze();
    return;
  }
  if (booksToVisit.length > 0) {
    let book = booksToVisit.pop();
    if (book in booksVisited) crawl();
    else analyzeBook(book, crawl);
  }
  else if (pagesToVisit.length >0) {
    let nextPage = pagesToVisit.pop();
    if (nextPage in pagesVisited) crawl();
    else visitPage(nextPage, crawl);
  }
  else analyze();
}

function visitPage(url, callback) {
  pagesVisited[url] = true;

  request(url, function (error, response, body) {
    if (response.statusCode !== 200) { //200 is HTTP OK
      callback();
      return;
    }
    console.log("Looking for books...")

    let $ = cheerio.load(body);

    findNextPage($);
    collectBookLinks($);

    callback();

  });
}

function analyzeBook(url, callback) {
  booksVisited[url] = true;
  numBooks++;
  if (numBooks%10==0) console.log(numBooks);
  request(url, function (error, response, body) {
    
    if (response.statusCode !== 200) {//200 is HTTP OK
      callback();
      return;
    }

    let book={};

    let $ = cheerio.load(body);
    let title = $("h1").text();
    
    let price = $(".sale-price").text();
    let numPages = $("span[itemprop='numberOfPages']").text();
    let author = $("span[itemprop='author']>a >span[itemprop='name']").text();
    price=processPrice(price);
    numPages=processPageNum(numPages);
    author=processAuthor(author);/*
    console.log("FOUND BOOK " + title);
    console.log('Author(s): ' + author);
    console.log('Price: ' +price);
    console.log('Pages: '+numPages);*/
    book['title']=title;
    book['author']=author;
    book['pages']=numPages;
    book['price'] = price;
    bookInfo.push(book);
    callback();

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

function collectBookLinks($) {
  let bookLinks = $("h3.title>a[href^='/']", '.content-block');
  bookLinks.each(function () {
    booksToVisit.push(baseUrl + $(this).attr('href'));
  });

}

function processPrice(str) {
  price=str.replace(" "+currency, "").replace(",", ".");
  return price;
}

function processPageNum(str) {
  pages = str.trim().replace(" pages", "");
  return pages;
}

function processAuthor(str) {
  author=str.trim();
  for (let i=0; i<author.length; i++)  author=author.replace(/\s\s+/, ', ');
  return author;
}

function analyze() {
  for (book in bookInfo) {
    console.log(book);
    let pricePerPage = bookInfo[book]['price']/bookInfo[book]['pages'];
    pricePerPage=Number(Math.round(pricePerPage+'e2')+'e-2')
    bookInfo[book]['priceperpage'] = pricePerPage;
    console.log(bookInfo[book]);
  }
}

//BEGIN

pagesToVisit.push(START_URL);
crawl();