const request = require("request-promise-native");

const fetchGoogleBooksApiResponse = async (isbn) => {
  const url = new URL("books/v1/volumes", "https://www.googleapis.com");
  url.search = new URLSearchParams({ q: `isbn:${isbn}` }).toString();
  let result;
  try {
    result = await request(url, { json: true });
  } catch (e) {
    throw e.body.error;
  }

  if (!result.items) return null;
  return result;
};

const fetchOpenLibraryApiResponse = async (isbn) => {
  const url = new URL(`isbn/${isbn}.json`, "https://openlibrary.org/");
  let result;
  try {
    result = await request(url, { json: true });
  } catch (e) {
    throw e.error;
  }
  return result;
};

const getEndpoint = (isbn, size) => `/b/isbn/${isbn}-${size}.jpg`;

const fetchOpenLibraryBookCover = async (isbn) => {
  const url = new URL(getEndpoint(isbn, "S"), "http://covers.openlibrary.org");
  url.search = "?default=false";
  try {
    await request({ uri: url.toString(), followRedirect: false });
  } catch (e) {
    switch (e.statusCode) {
      case 302: {
        const imageUrl = e.response.headers.location;
        return imageUrl.replace(/-S\./g, "-M.");
      }
      case 404:
        return null;
      default:
        throw e;
    }
  }
  return null;
};
const getConvertedBookTitle = (title) => {
  if (title !== null && title !== undefined) {
    let words = title.split(" ");
    let firstWord = words.shift();
    if (
      firstWord.toLowerCase() === "a" ||
      firstWord.toLowerCase() === "an" ||
      firstWord.toLowerCase() === "the"
    ) {
      return words.join(" ") + ", " + firstWord;
    } else {
      return title;
    }
  }
};

const getBookDataFromResponse = async (gBooksResp, openLibResp) => {
  const book = {};
  /* Consume the Google Books API response */
  if (gBooksResp.totalItems > 0) {
    const volumeInfo = gBooksResp.items[0].volumeInfo;
    const images = gBooksResp.items
      .map((item) => item.volumeInfo && item.volumeInfo.imageLinks)
      .filter((a) => !!a);

    // Assign basic information
    book.title = getConvertedBookTitle(volumeInfo.title) || "";
    book.subtitle = volumeInfo.subtitle || "";
    book.description = volumeInfo.description;
    book.page_count = volumeInfo.pageCount;
    book.thumbnail_url = images[0]["thumbnail"];

    // Compute ISBN information
    volumeInfo.industryIdentifiers.forEach((identifier) => {
      if (identifier.type.toLowerCase() === "isbn_10") {
        book.isbn10 = identifier.identifier;
      }
      if (identifier.type.toLowerCase() === "isbn_13") {
        book.isbn13 = identifier.identifier;
      }
    });

    //Compute Author information
    if (volumeInfo.authors.length > 0) {
      const authorName = volumeInfo.authors[0];
      const names = authorName.split(" ");
      book.author = {};
      book.author.firstName = names[0];
      book.author.lastName = names[1];
    }
  } else {
    /* Consume the Open Library response */
    book.title = openLibResp.title || "";
    book.subtitle = openLibResp.subtitle || "";
    if (openLibResp.description && openLibResp.description.value) {
      book.description = openLibResp.description.value || "";
    }
    book.page_count = openLibResp.number_of_pages || "";
  }

  if (!book.isbn13) {
    if (openLibResp.isbn_13 !== undefined && openLibResp.isbn_13.length > 0) {
      book.isbn13 = openLibResp.isbn_13[0];
    }
  }

  if (!book.isbn10) {
    if (openLibResp.isbn_10 !== undefined && openLibResp.isbn_10.length > 0) {
      book.isbn10 = openLibResp.isbn_10[0];
    }
  }

  if (!book.thumbnail_url) {
    const bookCover = await fetchOpenLibraryBookCover(book.isbn13);
    if (bookCover) {
      book.thumbnail_url = bookCover;
    }
  }
  return book;
};
module.exports = {
  fetchGoogleBooksApiResponse,
  fetchOpenLibraryApiResponse,
  getBookDataFromResponse,
};