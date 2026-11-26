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
