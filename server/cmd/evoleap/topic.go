package main

// 主題與清單項目的新增、刪除、排序。

import (
	"flag"
	"net/url"
	"strings"
)

func topicURL(topic string, rest ...string) string {
	p := "/api/admin/topics/" + url.PathEscape(topic)
	for _, s := range rest {
		p += "/" + url.PathEscape(s)
	}
	return p
}

func cmdTopicCreate(c *client, args []string) {
	fs := flag.NewFlagSet("topic create", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	name := fs.String("name", "", "主題名稱")
	slogan := fs.String("slogan", "", "主題的一句話")
	path := fs.String("path", "", "主題頁網址;還沒有主題頁就留空")
	parse(fs, args, "topic", "name")
	send(c, "POST", "/api/admin/topics", map[string]any{"id": *topic, "name": *name, "slogan": *slogan, "path": *path})
}

func cmdTopicDelete(c *client, args []string) {
	fs := flag.NewFlagSet("topic delete", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id(要先沒有課程)")
	parse(fs, args, "topic")
	send(c, "DELETE", topicURL(*topic), nil)
}

func cmdTopicOrder(c *client, args []string) {
	fs := flag.NewFlagSet("topic order", flag.ExitOnError)
	ids := fs.String("ids", "", "全部主題 id,依想要的順序用逗號分隔")
	parse(fs, args, "ids")
	send(c, "PUT", "/api/admin/topic-order", map[string]any{"ids": strings.Split(*ids, ",")})
}

func cmdTopicItemAdd(c *client, args []string) {
	fs := flag.NewFlagSet("topic item-add", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	kind := fs.String("kind", "", "outcome、pain、scenario、flow、learn、sample_before 或 sample_after")
	text := fs.String("text", "", "文字")
	level := fs.String("level", "", "階段名稱(只有 learn)")
	at := fs.Int("at", 0, "在同種類裡的位置(從 1 起算);不給排最後")
	parse(fs, args, "topic", "kind", "text")
	send(c, "POST", topicURL(*topic, "items"), map[string]any{"kind": *kind, "text": *text, "level": *level, "at": *at})
}

func cmdTopicItemSet(c *client, args []string) {
	fs := flag.NewFlagSet("topic item-set", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	item := fs.String("item", "", "項目 id(見 topic show)")
	text := fs.String("text", "", "文字")
	level := fs.String("level", "", "階段名稱(只有 learn);給空字串清掉")
	set := parse(fs, args, "topic", "item")
	patch := map[string]any{}
	if set["text"] {
		patch["text"] = *text
	}
	if set["level"] {
		patch["level"] = *level
	}
	if len(patch) == 0 {
		fatal("沒有要改的欄位(-text、-level)")
	}
	send(c, "PATCH", topicURL(*topic, "items", *item), patch)
}

func cmdTopicItemDelete(c *client, args []string) {
	fs := flag.NewFlagSet("topic item-delete", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	item := fs.String("item", "", "項目 id")
	parse(fs, args, "topic", "item")
	send(c, "DELETE", topicURL(*topic, "items", *item), nil)
}

func cmdTopicItemOrder(c *client, args []string) {
	fs := flag.NewFlagSet("topic item-order", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	kind := fs.String("kind", "", "項目種類")
	ids := fs.String("ids", "", "該種類全部項目 id,依想要的順序用逗號分隔")
	parse(fs, args, "topic", "kind", "ids")
	send(c, "PUT", topicURL(*topic, "item-order"), map[string]any{"kind": *kind, "ids": strings.Split(*ids, ",")})
}

// 主題頁的區塊(section)與項目(block);欄位的意思見 internal/store/topicpage.go。

var sectionFields = []string{"eyebrow", "title", "lead", "source", "variant"}

var blockFields = []string{"title", "text", "note", "ref", "variant", "label"}

// stringFlags 定義一組字串旗標,回傳取值的函式。
func stringFlags(fs *flag.FlagSet, names []string) map[string]*string {
	out := map[string]*string{}
	for _, n := range names {
		out[n] = fs.String(n, "", n+";給空字串清掉。\\n 代表換行")
	}
	return out
}

// given 收集指令列上有給的欄位。
func given(set map[string]bool, flags map[string]*string, body map[string]any) map[string]any {
	for n, v := range flags {
		if set[n] {
			body[n] = strings.ReplaceAll(*v, `\n`, "\n")
		}
	}
	return body
}

func cmdTopicSectionAdd(c *client, args []string) {
	fs := flag.NewFlagSet("topic section-add", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	id := fs.String("id", "", "區塊 id(也是頁面錨點)")
	kind := fs.String("kind", "", "hero、levels、cards、lists、units 或 features")
	at := fs.Int("at", 0, "位置(從 1 起算);不給排最後")
	flags := stringFlags(fs, sectionFields)
	set := parse(fs, args, "topic", "id", "kind")
	send(c, "POST", topicURL(*topic, "sections"), given(set, flags, map[string]any{"id": *id, "kind": *kind, "at": *at}))
}

func cmdTopicSectionSet(c *client, args []string) {
	fs := flag.NewFlagSet("topic section-set", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	section := fs.String("section", "", "區塊 id")
	flags := stringFlags(fs, sectionFields)
	set := parse(fs, args, "topic", "section")
	patch := given(set, flags, map[string]any{})
	if len(patch) == 0 {
		fatal("沒有要改的欄位")
	}
	send(c, "PATCH", topicURL(*topic, "sections", *section), patch)
}

func cmdTopicSectionDelete(c *client, args []string) {
	fs := flag.NewFlagSet("topic section-delete", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	section := fs.String("section", "", "區塊 id")
	parse(fs, args, "topic", "section")
	send(c, "DELETE", topicURL(*topic, "sections", *section), nil)
}

func cmdTopicSectionOrder(c *client, args []string) {
	fs := flag.NewFlagSet("topic section-order", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	ids := fs.String("ids", "", "全部區塊 id,依順序用逗號分隔")
	parse(fs, args, "topic", "ids")
	send(c, "PUT", topicURL(*topic, "section-order"), map[string]any{"ids": strings.Split(*ids, ",")})
}

func cmdTopicBlockAdd(c *client, args []string) {
	fs := flag.NewFlagSet("topic block-add", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	section := fs.String("section", "", "區塊 id")
	parent := fs.String("parent", "", "上層項目 id(加子項目時)")
	at := fs.Int("at", 0, "位置(從 1 起算);不給排最後")
	flags := stringFlags(fs, blockFields)
	set := parse(fs, args, "topic", "section")
	send(c, "POST", topicURL(*topic, "blocks"), given(set, flags, map[string]any{"section": *section, "parent": *parent, "at": *at}))
}

func cmdTopicBlockSet(c *client, args []string) {
	fs := flag.NewFlagSet("topic block-set", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	block := fs.String("block", "", "項目 id(見 topic show)")
	flags := stringFlags(fs, blockFields)
	set := parse(fs, args, "topic", "block")
	patch := given(set, flags, map[string]any{})
	if len(patch) == 0 {
		fatal("沒有要改的欄位")
	}
	send(c, "PATCH", topicURL(*topic, "blocks", *block), patch)
}

func cmdTopicBlockDelete(c *client, args []string) {
	fs := flag.NewFlagSet("topic block-delete", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	block := fs.String("block", "", "項目 id")
	parse(fs, args, "topic", "block")
	send(c, "DELETE", topicURL(*topic, "blocks", *block), nil)
}

func cmdTopicBlockOrder(c *client, args []string) {
	fs := flag.NewFlagSet("topic block-order", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	section := fs.String("section", "", "區塊 id")
	parent := fs.String("parent", "", "上層項目 id(排子項目時)")
	ids := fs.String("ids", "", "同一層全部項目 id,依順序用逗號分隔")
	parse(fs, args, "topic", "section", "ids")
	send(c, "PUT", topicURL(*topic, "block-order"), map[string]any{"section": *section, "parent": *parent, "ids": strings.Split(*ids, ",")})
}
