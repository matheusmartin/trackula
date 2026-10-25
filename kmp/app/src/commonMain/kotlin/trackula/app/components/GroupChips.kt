package trackula.app.components

/** The label of a group chip: the group with a capital first letter. Example: "habits" → "Habits". */
fun groupLabel(group: String): String = group.replaceFirstChar { it.uppercaseChar() }
