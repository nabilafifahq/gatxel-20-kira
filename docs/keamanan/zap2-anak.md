# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 1 |
| Low | 4 |
| Informational | 4 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 9    |
| Info | Informational | http://proxy:8080 | Percentage of responses with status code 2xx | 24 % |
| Info | Informational | http://proxy:8080 | Percentage of responses with status code 3xx | 75 % |
| Info | Informational | http://proxy:8080 | Percentage of responses with status code 4xx | 1 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type application/manifest+json | 1 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type font/woff2 | 1 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type image/png | 1 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type image/svg+xml | 1 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type image/x-icon | 1 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type text/css | 1 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type text/html | 88 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type text/javascript | 8 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://proxy:8080 | Count of total endpoints | 474    |
| Info | Informational | http://proxy:8080 | Percentage of slow responses | 53 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| CSP: style-src unsafe-inline | Medium | Systemic |
| Big Redirect Detected (Potential Sensitive Information Leak) | Low | 10 |
| Cross-Origin-Embedder-Policy Header Missing or Invalid | Low | 2 |
| Cross-Origin-Resource-Policy Header Missing or Invalid | Low | Systemic |
| Permissions Policy Header Not Set | Low | Systemic |
| Modern Web Application | Informational | Systemic |
| Non-Storable Content | Informational | 4 |
| Storable and Cacheable Content | Informational | Systemic |
| User Controllable HTML Element Attribute (Potential XSS) | Informational | 1 |




## Alert Detail



### [ CSP: style-src unsafe-inline ](https://www.zaproxy.org/docs/alerts/10055/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks. Including (but not limited to) Cross Site Scripting (XSS), and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: http://proxy:8080/
  * Node Name: `http://proxy:8080/`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-MDdjYTg3ZDgtZWEwZi00ZThkLWFiY2QtZWFiMTcxODViYjk0' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://proxy:8080/
  * Node Name: `http://proxy:8080/`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-NjIxOTljNWYtMWUzMy00ZjQ2LTljOTQtN2VhMmQ0YjY0OGY2' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://proxy:8080/sitemap.xml
  * Node Name: `http://proxy:8080/sitemap.xml`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-ZmMwYTBhMDEtYjI2NS00ZmYyLWExNWQtZTBkZWFkMTJjNjkw' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://proxy:8080/today
  * Node Name: `http://proxy:8080/today`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-MjliMmIwZmItNGQzNC00YjAzLWJhN2ItZWVmZjY4OTE4MDNl' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`

Instances: Systemic


### Solution

Ensure that your web server, application server, load balancer, etc. is properly configured to set the Content-Security-Policy header.

### Reference


* [ https://www.w3.org/TR/CSP/ ](https://www.w3.org/TR/CSP/)
* [ https://caniuse.com/#search=content+security+policy ](https://caniuse.com/#search=content+security+policy)
* [ https://content-security-policy.com/ ](https://content-security-policy.com/)
* [ https://github.com/HtmlUnit/htmlunit-csp ](https://github.com/HtmlUnit/htmlunit-csp)
* [ https://web.dev/articles/csp#resource-options ](https://web.dev/articles/csp#resource-options)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ Big Redirect Detected (Potential Sensitive Information Leak) ](https://www.zaproxy.org/docs/alerts/10044/)



##### Low (Medium)

### Description

The server has responded with a redirect that seems to provide a large response. This may indicate that although the server sent a redirect it also responded with body content (which may include sensitive details, PII, etc.).

* URL: http://proxy:8080/quiz-arena/words
  * Node Name: `http://proxy:8080/quiz-arena/words`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 10,348.`
* URL: http://proxy:8080/results/62af5861-926f-4a0b-8ac2-73ec44b1c4dd/review
  * Node Name: `http://proxy:8080/results/62af5861-926f-4a0b-8ac2-73ec44b1c4dd/review`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 11,397.`
* URL: http://proxy:8080/results/ead1fb9e-bc8d-477b-b902-205ed29d3a3c/review
  * Node Name: `http://proxy:8080/results/ead1fb9e-bc8d-477b-b902-205ed29d3a3c/review`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 11,397.`
* URL: http://proxy:8080/results/ead1fb9e-bc8d-477b-b902-205ed29d3a3c/review%3Fq=8
  * Node Name: `http://proxy:8080/results/ead1fb9e-bc8d-477b-b902-205ed29d3a3c/review (q)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 11,405.`
* URL: http://proxy:8080/run/248e0072-5db3-42fe-ba1f-2a02ac566958
  * Node Name: `http://proxy:8080/run/248e0072-5db3-42fe-ba1f-2a02ac566958`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 11,049.`
* URL: http://proxy:8080/run/6a1720a4-efea-4553-aaa8-fcca6e1b339f
  * Node Name: `http://proxy:8080/run/6a1720a4-efea-4553-aaa8-fcca6e1b339f`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 11,049.`
* URL: http://proxy:8080/run/be8c2d6e-2e7b-43f1-8f18-13b596c037ed
  * Node Name: `http://proxy:8080/run/be8c2d6e-2e7b-43f1-8f18-13b596c037ed`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 11,049.`
* URL: http://proxy:8080/run/bfb512da-e9fc-45d5-a0ea-8c6bbdf02120
  * Node Name: `http://proxy:8080/run/bfb512da-e9fc-45d5-a0ea-8c6bbdf02120`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 11,049.`
* URL: http://proxy:8080/run/d4bd0f03-28fe-4e2f-9eab-ec30ad71fb27
  * Node Name: `http://proxy:8080/run/d4bd0f03-28fe-4e2f-9eab-ec30ad71fb27`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 11,049.`
* URL: http://proxy:8080/run/e924108c-b96a-48ec-b97a-8ddda20163c7
  * Node Name: `http://proxy:8080/run/e924108c-b96a-48ec-b97a-8ddda20163c7`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 1 [/].
Predicted response size: 301.
Response Body Length: 11,049.`


Instances: 10

### Solution

Ensure that no sensitive information is leaked via redirect responses. Redirect responses should have almost no content.

### Reference



#### CWE Id: [ 201 ](https://cwe.mitre.org/data/definitions/201.html)


#### WASC Id: 13

#### Source ID: 3

### [ Cross-Origin-Embedder-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Embedder-Policy header is a response header that prevents a document from loading any cross-origin resources that don't explicitly grant the document permission (using CORP or CORS).

* URL: http://proxy:8080/
  * Node Name: `http://proxy:8080/`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://proxy:8080/today
  * Node Name: `http://proxy:8080/today`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 2

### Solution

Ensure that the application/web server sets the Cross-Origin-Embedder-Policy header appropriately, and that it sets the Cross-Origin-Embedder-Policy header to 'require-corp' for documents.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Embedder-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-embedder-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Cross-Origin-Resource-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Resource-Policy header is an opt-in header designed to counter side-channels attacks like Spectre. Resource should be specifically set as shareable amongst different origins.

* URL: http://proxy:8080/_next/static/chunks/0d6nlfa6zm0hb.js
  * Node Name: `http://proxy:8080/_next/static/chunks/0d6nlfa6zm0hb.js`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://proxy:8080/_next/static/chunks/3hv3n3jqhpo2d.js
  * Node Name: `http://proxy:8080/_next/static/chunks/3hv3n3jqhpo2d.js`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://proxy:8080/fonts/Fredoka.woff2
  * Node Name: `http://proxy:8080/fonts/Fredoka.woff2`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://proxy:8080/fonts/Nunito.woff2
  * Node Name: `http://proxy:8080/fonts/Nunito.woff2`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://proxy:8080/today
  * Node Name: `http://proxy:8080/today`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that the application/web server sets the Cross-Origin-Resource-Policy header appropriately, and that it sets the Cross-Origin-Resource-Policy header to 'same-origin' for all web pages.
'same-site' is considered as less secured and should be avoided.
If resources must be shared, set the header to 'cross-origin'.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Resource-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-resource-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Permissions Policy Header Not Set ](https://www.zaproxy.org/docs/alerts/10063/)



##### Low (Medium)

### Description

Permissions Policy Header is an added layer of security that helps to restrict from unauthorized access or usage of browser/client features by web resources. This policy ensures the user privacy by limiting or specifying the features of the browsers can be used by the web resources. Permissions Policy provides a set of standard HTTP headers that allow website owners to limit which features of browsers can be used by the page such as camera, microphone, location, full screen etc.

* URL: http://proxy:8080/_next/static/chunks/0d6nlfa6zm0hb.js
  * Node Name: `http://proxy:8080/_next/static/chunks/0d6nlfa6zm0hb.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://proxy:8080/_next/static/chunks/2shjhxa-2svf9.js
  * Node Name: `http://proxy:8080/_next/static/chunks/2shjhxa-2svf9.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://proxy:8080/_next/static/chunks/32r7cro4b038k.js
  * Node Name: `http://proxy:8080/_next/static/chunks/32r7cro4b038k.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://proxy:8080/_next/static/chunks/3hv3n3jqhpo2d.js
  * Node Name: `http://proxy:8080/_next/static/chunks/3hv3n3jqhpo2d.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://proxy:8080/_next/static/chunks/turbopack-2c3mg3r-05n1w.js
  * Node Name: `http://proxy:8080/_next/static/chunks/turbopack-2c3mg3r-05n1w.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that your web server, application server, load balancer, etc. is configured to set the Permissions-Policy header.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy)
* [ https://developer.chrome.com/blog/feature-policy/ ](https://developer.chrome.com/blog/feature-policy/)
* [ https://scotthelme.co.uk/a-new-security-header-feature-policy/ ](https://scotthelme.co.uk/a-new-security-header-feature-policy/)
* [ https://w3c.github.io/webappsec-feature-policy/ ](https://w3c.github.io/webappsec-feature-policy/)
* [ https://www.smashingmagazine.com/2018/12/feature-policy/ ](https://www.smashingmagazine.com/2018/12/feature-policy/)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ Modern Web Application ](https://www.zaproxy.org/docs/alerts/10109/)



##### Informational (Medium)

### Description

The application appears to be a modern web application. If you need to explore it automatically then the Client Spider may well be more effective than the standard one.

* URL: http://proxy:8080/
  * Node Name: `http://proxy:8080/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/12-0xr1dukgou.js" async="" nonce="NjIxOTljNWYtMWUzMy00ZjQ2LTljOTQtN2VhMmQ0YjY0OGY2"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://proxy:8080/run/2537984e-6ae2-4e9c-ba88-824a84b80c27
  * Node Name: `http://proxy:8080/run/2537984e-6ae2-4e9c-ba88-824a84b80c27`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/12-0xr1dukgou.js" async="" nonce="NjVlMjc3YjAtYzhiOS00NjBiLTkwYWQtOTcwNmM2OGM0MzI3"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://proxy:8080/run/31d68044-01a1-4f01-963e-2375fb2942ca
  * Node Name: `http://proxy:8080/run/31d68044-01a1-4f01-963e-2375fb2942ca`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/12-0xr1dukgou.js" async="" nonce="ZjgzMzQ4ODMtOTMxOS00MDhkLTkwMTYtYmNmMjJjZTBlMGFm"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://proxy:8080/run/56f188eb-6bc8-4e24-8b0c-fe0f44708574
  * Node Name: `http://proxy:8080/run/56f188eb-6bc8-4e24-8b0c-fe0f44708574`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/12-0xr1dukgou.js" async="" nonce="NDM0ZmQ0NGYtY2MyZi00MDU3LTg4M2MtZDQyYTllZjk5ZjIw"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://proxy:8080/run/e267356f-48c8-4d32-bb1f-02e7312ed547
  * Node Name: `http://proxy:8080/run/e267356f-48c8-4d32-bb1f-02e7312ed547`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/12-0xr1dukgou.js" async="" nonce="ZmE3YTgzOTktYWU5My00NmUzLTk1YmUtMzI1MmExZDU4YWZl"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`

Instances: Systemic


### Solution

This is an informational alert and so no changes are required.

### Reference




#### Source ID: 3

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://proxy:8080/
  * Node Name: `http://proxy:8080/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://proxy:8080/robots.txt
  * Node Name: `http://proxy:8080/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://proxy:8080/sitemap.xml
  * Node Name: `http://proxy:8080/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://proxy:8080/today
  * Node Name: `http://proxy:8080/today`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``


Instances: 4

### Solution

The content may be marked as storable by ensuring that the following conditions are satisfied:
The request method must be understood by the cache and defined as being cacheable ("GET", "HEAD", and "POST" are currently defined as cacheable)
The response status code must be understood by the cache (one of the 1XX, 2XX, 3XX, 4XX, or 5XX response classes are generally understood)
The "no-store" cache directive must not appear in the request or response header fields
For caching by "shared" caches such as "proxy" caches, the "private" response directive must not appear in the response
For caching by "shared" caches such as "proxy" caches, the "Authorization" header field must not appear in the request, unless the response explicitly allows it (using one of the "must-revalidate", "public", or "s-maxage" Cache-Control response directives)
In addition to the conditions above, at least one of the following conditions must also be satisfied by the response:
It must contain an "Expires" header field
It must contain a "max-age" response directive
For "shared" caches such as "proxy" caches, it must contain a "s-maxage" response directive
It must contain a "Cache Control Extension" that allows it to be cached
It must have a status code that is defined as cacheable by default (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501).

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable and Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, and may be retrieved directly from the cache, rather than from the origin server by the caching servers, in response to similar requests from other users. If the response data is sensitive, personal or user-specific, this may result in sensitive information being leaked. In some cases, this may even result in a user gaining complete control of the session of another user, depending on the configuration of the caching components in use in their environment. This is primarily an issue where "shared" caching servers such as "proxy" caches are configured on the local network. This configuration is typically found in corporate or educational environments, for instance.

* URL: http://proxy:8080/_next/static/chunks/0d6nlfa6zm0hb.js
  * Node Name: `http://proxy:8080/_next/static/chunks/0d6nlfa6zm0hb.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://proxy:8080/_next/static/chunks/2c6qlos-dm98g.css
  * Node Name: `http://proxy:8080/_next/static/chunks/2c6qlos-dm98g.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://proxy:8080/_next/static/chunks/3hv3n3jqhpo2d.js
  * Node Name: `http://proxy:8080/_next/static/chunks/3hv3n3jqhpo2d.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://proxy:8080/fonts/Fredoka.woff2
  * Node Name: `http://proxy:8080/fonts/Fredoka.woff2`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=604800`
  * Other Info: ``
* URL: http://proxy:8080/fonts/Nunito.woff2
  * Node Name: `http://proxy:8080/fonts/Nunito.woff2`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=604800`
  * Other Info: ``

Instances: Systemic


### Solution

Validate that the response does not contain sensitive, personal or user-specific information. If it does, consider the use of the following HTTP response headers, to limit, or prevent the content being stored and retrieved from the cache by another user:
Cache-Control: no-cache, no-store, must-revalidate, private
Pragma: no-cache
Expires: 0
This configuration directs both HTTP 1.0 and HTTP 1.1 compliant caching servers to not store the response, and to not retrieve the response (without validation) from the cache, in response to a similar request.

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ User Controllable HTML Element Attribute (Potential XSS) ](https://www.zaproxy.org/docs/alerts/10031/)



##### Informational (Low)

### Description

This check looks at user-supplied input in query string parameters and POST data to identify where certain HTML attribute values might be controlled. This provides hot-spot detection for XSS (cross-site scripting) that will require further review by a security analyst to determine exploitability.

* URL: http://proxy:8080/results/62af5861-926f-4a0b-8ac2-73ec44b1c4dd/review%3Fq=10
  * Node Name: `http://proxy:8080/results/62af5861-926f-4a0b-8ac2-73ec44b1c4dd/review (q)`
  * Method: `GET`
  * Parameter: `q`
  * Attack: ``
  * Evidence: ``
  * Other Info: `User-controlled HTML attribute values were found. Try injecting special characters to see if XSS might be possible. The page at the following URL:

http://proxy:8080/results/62af5861-926f-4a0b-8ac2-73ec44b1c4dd/review?q=10

appears to include user input in:
a(n) [rect] tag [x] attribute

The user input found was:
q=10

The user-controlled value was:
10`


Instances: 1

### Solution

Validate all input and sanitize output it before writing to any HTML attributes.

### Reference


* [ https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html ](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)


#### CWE Id: [ 20 ](https://cwe.mitre.org/data/definitions/20.html)


#### WASC Id: 20

#### Source ID: 3


