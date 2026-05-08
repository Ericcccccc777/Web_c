const test = require("node:test");
const assert = require("node:assert/strict");
const { GovernmentNoticeParser } = require("../src/parsers/GovernmentNoticeParser.js");

test("parses notice titles with nearby ISO dates", () => {
  const parser = new GovernmentNoticeParser();
  const notices = parser.parse(
    {
      id: "demo",
      name: "测试网站",
      url: "https://example.com/list/index.html",
      listSelector: "a",
      titleKeywords: ["关于", "通知"]
    },
    `
      <ul>
        <li><a href="./a.html">关于开展项目申报工作的通知</a>2026-05-01</li>
        <li><a href="./index.html">首页</a></li>
      </ul>
    `
  );

  assert.equal(notices.length, 1);
  assert.equal(notices[0].title, "关于开展项目申报工作的通知");
  assert.equal(notices[0].date, "2026-05-01");
  assert.equal(notices[0].url, "https://example.com/list/a.html");
});
