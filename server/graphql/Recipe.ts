import {
  Field,
  ObjectType,
  Int,
  registerEnumType,
  createUnionType,
} from "type-graphql";

export enum Difficulty {
  Beginner,
  Easy,
  Medium,
  Hard,
  MasterChef,
}

registerEnumType(Difficulty, {
  name: "Difficulty",
  description: "All possible preparation difficulty levels",
});

@ObjectType()
export class Cook {
  @Field()
  name!: string;

  @Field((type) => Int)
  yearsOfExperience!: number;
}

@ObjectType()
export class Recipe {
  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field((type) => [String])
  ingredients!: string[];

  @Field((type) => Difficulty)
  preparationDifficulty!: Difficulty;

  @Field()
  cook!: Cook;
}

export const SearchResult = createUnionType({
  name: "SearchResult",
  types: () => [Recipe, Cook] as const,
});